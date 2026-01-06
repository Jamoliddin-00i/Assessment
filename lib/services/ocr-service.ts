import mammoth from "mammoth";
import * as XLSX from "xlsx";
import { GoogleGenAI } from "@google/genai";

export interface OcrResult {
  text: string;
  confidence: number;
}

// Result with sorted order for reordering images
export interface OcrResultWithOrder extends OcrResult {
  // Array of original indices in the sorted page order
  // e.g., [2, 0, 1] means original image 2 is page 1, image 0 is page 2, image 1 is page 3
  sortedOriginalIndices: number[];
}

// Result for page sorting only (no OCR text)
export interface PageSortResult {
  // Original buffers reordered by page number
  sortedBuffers: { buffer: Buffer; mimeType: string }[];
  // Array of original indices in the sorted page order
  sortedOriginalIndices: number[];
}

const BATCH_SIZE = 5;

// QVQ-Max model from Alibaba/Qwen for visual reasoning
const QVQ_MODEL = "qvq-max";

// Gemini 2.0 Flash Lite for fast page detection (cheapest & fastest)
const GEMINI_PAGE_DETECTION_MODEL = "gemini-2.0-flash-lite";

// Gemini 2.5 Flash Preview for all OCR tasks (best price/performance)
// Used for: mark scheme OCR (PDF & images), student handwritten OCR
const GEMINI_PRO_OCR_MODEL = "gemini-2.5-flash-preview-09-2025";

// Initialize Gemini client
function getGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not configured");
  }
  return new GoogleGenAI({ apiKey });
}

// DashScope API endpoint
const DASHSCOPE_API_URL = "https://dashscope-intl.aliyuncs.com/compatible-mode/v1/chat/completions";

// Get API key
function getApiKey(): string {
  const apiKey = process.env.QVQ_API_KEY || process.env.DASHSCOPE_API_KEY;
  if (!apiKey) {
    throw new Error("QVQ_API_KEY or DASHSCOPE_API_KEY is not configured");
  }
  return apiKey;
}

/**
 * Make a streaming request to QVQ-Max API with retry logic
 * QVQ-Max only supports streaming output (used for mark scheme)
 */
async function callQvqApi(messages: Array<{role: string; content: unknown}>): Promise<string> {
  const apiKey = getApiKey();
  const maxRetries = 3;
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(DASHSCOPE_API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: QVQ_MODEL,
          messages: messages,
          stream: true, // QVQ-Max requires streaming
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("QVQ API Error:", response.status, errorText);
        throw new Error(`QVQ API error: ${response.status} - ${errorText}`);
      }

      // Process SSE stream
      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error("Failed to get response reader");
      }

      const decoder = new TextDecoder();
      let answerContent = "";

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split("\n");

          for (const line of lines) {
            if (line.startsWith("data: ")) {
              const data = line.slice(6);
              if (data === "[DONE]") continue;

              try {
                const parsed = JSON.parse(data);
                const delta = parsed.choices?.[0]?.delta;

                // Collect the answer content (not reasoning_content which is the thinking process)
                if (delta?.content) {
                  answerContent += delta.content;
                }
              } catch {
                // Skip invalid JSON lines
              }
            }
          }
        }
      } finally {
        reader.releaseLock();
      }

      return answerContent.trim();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      console.error(`QVQ API attempt ${attempt}/${maxRetries} failed:`, lastError.message);

      // Check if retryable
      const isRetryable = lastError.message.includes('fetch failed') ||
                         lastError.message.includes('ECONNRESET') ||
                         lastError.message.includes('ETIMEDOUT') ||
                         lastError.message.includes('ENOTFOUND') ||
                         lastError.message.includes('network') ||
                         lastError.message.includes('timeout');

      if (isRetryable && attempt < maxRetries) {
        const delay = attempt * 3000; // 3s, 6s, 9s
        console.log(`Retrying QVQ API in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      } else if (!isRetryable) {
        throw lastError;
      }
    }
  }

  throw lastError || new Error("QVQ API failed after retries");
}

/**
 * Split array into chunks of specified size
 */
function chunkArray<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

/**
 * Get MIME type prefix for base64 data URL
 */
function getMimePrefix(mimeType: string): string {
  return `data:${mimeType};base64,`;
}

// Comprehensive multi-subject OCR prompt with LaTeX output
const OCR_PROMPT_SINGLE = `You are an expert OCR system specialized in reading handwritten academic content across ALL subjects.

Extract ALL text from this image with extreme care for accuracy. Output mathematical, scientific, and technical content in LaTeX format where applicable.

═══════════════════════════════════════════════════════════════════════════════
                              TEXT & GENERAL CONTENT
═══════════════════════════════════════════════════════════════════════════════
• Extract all handwritten and printed text verbatim
• Question numbers and labels (Q1, Q2, a), b), i), ii), etc.)
• Headers, titles, annotations, and marginal notes
• Preserve original language (English, foreign language text, etc.)

═══════════════════════════════════════════════════════════════════════════════
                        MATHEMATICS (Use LaTeX notation)
═══════════════════════════════════════════════════════════════════════════════
• Fractions: \\frac{numerator}{denominator}
• Powers/Exponents: x^{2}, e^{x}, a^{n+1}
• Subscripts: x_{1}, a_{n}, v_{0}
• Square roots: \\sqrt{x}, \\sqrt[n]{x}
• Greek letters: \\alpha, \\beta, \\gamma, \\theta, \\pi, \\sigma, \\lambda, \\omega, \\Delta, \\Omega
• Trigonometry: \\sin, \\cos, \\tan, \\csc, \\sec, \\cot
• Logarithms: \\log, \\ln, \\log_{b}
• Limits: \\lim_{x \\to a} f(x)
• Derivatives: \\frac{d}{dx}, \\frac{dy}{dx}, f'(x), f''(x)
• Partial derivatives: \\frac{\\partial f}{\\partial x}
• Integrals: \\int, \\int_{a}^{b}, \\iint, \\oint
• Summations: \\sum_{i=1}^{n}, \\prod_{i=1}^{n}
• Matrices: \\begin{pmatrix} a & b \\\\ c & d \\end{pmatrix}
• Vectors: \\vec{v}, \\mathbf{v}, \\overrightarrow{AB}
• Set notation: \\in, \\notin, \\subset, \\subseteq, \\cup, \\cap, \\emptyset
• Logic: \\forall, \\exists, \\neg, \\land, \\lor, \\implies, \\iff
• Inequalities: \\leq, \\geq, \\neq, \\approx
• Infinity: \\infty

═══════════════════════════════════════════════════════════════════════════════
                                    PHYSICS
═══════════════════════════════════════════════════════════════════════════════
• Equations: Use LaTeX (e.g., F = ma as $F = ma$, E = mc^2 as $E = mc^{2}$)
• Units: Format with proper spacing (e.g., 9.8 m/s² or $9.8 \\text{ m/s}^{2}$)
• Vectors: \\vec{F}, \\vec{v}, \\vec{a}
• Circuit diagrams: Describe components and connections in detail
  [Describe: "Resistor R1 (10Ω) connected in series with capacitor C (100μF)..."]
• Wave diagrams: Note wavelength, amplitude, frequency if shown
• Force diagrams: List all forces with directions

═══════════════════════════════════════════════════════════════════════════════
                                   CHEMISTRY
═══════════════════════════════════════════════════════════════════════════════
• Chemical formulas: H_{2}O, CO_{2}, C_{6}H_{12}O_{6}, Fe^{3+}
• Equations: Use \\rightarrow or \\rightleftharpoons for reactions
  Example: $2H_{2} + O_{2} \\rightarrow 2H_{2}O$
• Structural formulas: Describe bonds and arrangement
  [Structure: "Carbon atom bonded to 4 hydrogen atoms in tetrahedral arrangement"]
• Electron configurations: 1s² 2s² 2p⁶ or $1s^{2} 2s^{2} 2p^{6}$
• Organic structures: Describe functional groups and carbon chains
• Lewis structures: Describe electron pairs and bonds

═══════════════════════════════════════════════════════════════════════════════
                                    BIOLOGY
═══════════════════════════════════════════════════════════════════════════════
• Scientific names: Use italics indication (e.g., _Homo sapiens_)
• Cell diagrams: Describe all labeled organelles and structures
  [Diagram: "Cell membrane (outer), Nucleus (center, containing nucleolus),
   Mitochondria (oval shapes with inner folds), Ribosomes (small dots)..."]
• Cycles (Krebs, Calvin, etc.): List each step with inputs/outputs
• Genetic notation: Alleles (Aa, BB), genotypes, phenotypes
• Punnett squares: Capture as tables with allele combinations

═══════════════════════════════════════════════════════════════════════════════
                              COMPUTER SCIENCE
═══════════════════════════════════════════════════════════════════════════════
• Code: Preserve exact syntax and indentation
  \`\`\`
  def function():
      return value
  \`\`\`
• Pseudocode: Maintain structure and keywords
• Binary/Hex: Prefix appropriately (0b1010, 0xFF)
• Data structures:
  - Arrays: [val1, val2, val3]
  - Linked lists: Node1 → Node2 → Node3 → NULL
  - Trees: Root(LeftChild, RightChild) or indented hierarchy
  - Graphs: V = {A, B, C}, E = {(A,B), (B,C)}
  - Stacks/Queues: Describe top/front and operations
• Big O notation: $O(n)$, $O(n^{2})$, $O(\\log n)$
• Boolean algebra: Use \\land, \\lor, \\neg or describe as AND, OR, NOT

═══════════════════════════════════════════════════════════════════════════════
                              GEOGRAPHY & ECONOMICS
═══════════════════════════════════════════════════════════════════════════════
• Maps: Describe regions, labels, legends, scale, compass direction
• Charts/Graphs: List axis labels, data points, trends
• Statistical data: Preserve all numbers and categories
• Currency: Use proper symbols (£, $, €, ¥)
• Percentages: $45\\%$ or 45%

═══════════════════════════════════════════════════════════════════════════════
                         TABLES (CRITICAL - READ CAREFULLY)
═══════════════════════════════════════════════════════════════════════════════
MANDATORY PROCEDURE FOR ALL TABLES:
1. FIRST: Count the exact number of columns
2. SECOND: Identify all column headers
3. THIRD: Read each row LEFT-TO-RIGHT, cell by cell
4. FOURTH: Verify row count matches what you see
5. FIFTH: Output in markdown table format

BINARY/TRUTH TABLES - EXTREME PRECISION REQUIRED:
• STOP and focus entirely on the table
• 0 = circular/oval closed shape (like the letter O)
• 1 = vertical line (may have serifs, looks like I or l)
• Read EACH CELL individually - do NOT assume patterns
• Double-check every single value before moving to next cell
• Count columns first, ensure every row has same number of cells

Example table format:
| A | B | C | Output |
|---|---|---|--------|
| 0 | 0 | 0 |   0    |
| 0 | 0 | 1 |   1    |

DATA TABLES:
• Preserve all headers exactly as written
• Include units in headers if shown
• Align numerical data appropriately
• Note any totals, averages, or summary rows

═══════════════════════════════════════════════════════════════════════════════
                    DIAGRAMS & NON-TEXT ELEMENTS
═══════════════════════════════════════════════════════════════════════════════
When you encounter diagrams, graphs, or visual elements that cannot be represented
in text/LaTeX, provide a detailed description in square brackets:

[DIAGRAM: <type>
 - Component 1: description
 - Component 2: description
 - Relationships/connections: description
 - Labels visible: list all
 - Annotations: any written notes on the diagram]

Examples:
[CIRCUIT DIAGRAM: Series circuit with battery (9V), resistor R1 (100Ω), LED,
 and ammeter. Current flows clockwise. Switch S1 between battery and R1.]

[GRAPH: Line graph showing Temperature (°C) on y-axis (0-100) vs Time (min)
 on x-axis (0-30). Line starts at 20°C, rises steeply to 80°C at 15min,
 then plateaus. Points marked at (5,40), (10,65), (15,80), (20,80).]

═══════════════════════════════════════════════════════════════════════════════
                              OUTPUT INSTRUCTIONS
═══════════════════════════════════════════════════════════════════════════════
1. Extract EVERYTHING visible - do not skip any content
2. Use LaTeX ($...$) for ALL mathematical and scientific expressions
3. Preserve original structure and order
4. For unclear handwriting, make your best educated guess with [uncertain: X]
5. Use markdown formatting for structure (headers, lists, tables)
6. Do NOT add explanations, commentary, or interpretations
7. Do NOT say "I cannot read" - always attempt extraction

OUTPUT: Return ONLY the extracted content, preserving its structure.`;

const OCR_PROMPT_BATCH = (startPage: number, endPage: number, batchNum: number, totalBatches: number) =>
  `You are an expert OCR system specialized in reading handwritten academic content across ALL subjects.

These are pages ${startPage} to ${endPage} of a student's answer sheet (batch ${batchNum} of ${totalBatches}).

Extract ALL text from these images with extreme care for accuracy. Output mathematical, scientific, and technical content in LaTeX format.

═══════════════════════════════════════════════════════════════════════════════
                              TEXT & GENERAL CONTENT
═══════════════════════════════════════════════════════════════════════════════
• Extract all handwritten and printed text verbatim
• Question numbers and labels (Q1, Q2, a), b), i), ii), etc.)
• Page numbers if visible
• Headers, titles, annotations

═══════════════════════════════════════════════════════════════════════════════
                        MATHEMATICS (Use LaTeX notation)
═══════════════════════════════════════════════════════════════════════════════
• Fractions: \\frac{a}{b} | Powers: x^{2} | Subscripts: x_{1}
• Roots: \\sqrt{x}, \\sqrt[n]{x}
• Greek: \\alpha, \\beta, \\gamma, \\theta, \\pi, \\sigma, \\lambda, \\Delta
• Calculus: \\frac{d}{dx}, \\int_{a}^{b}, \\lim_{x \\to a}, \\sum_{i=1}^{n}
• Matrices: \\begin{pmatrix} a & b \\\\ c & d \\end{pmatrix}
• Vectors: \\vec{v}, \\mathbf{v}
• Sets: \\in, \\cup, \\cap, \\subset, \\emptyset
• Logic: \\forall, \\exists, \\implies, \\iff, \\neg, \\land, \\lor

═══════════════════════════════════════════════════════════════════════════════
                              SCIENCES (Physics, Chemistry, Biology)
═══════════════════════════════════════════════════════════════════════════════
• Physics: Use LaTeX for equations. Describe circuits, diagrams in [DIAGRAM: ...]
• Chemistry: H_{2}O, \\rightarrow for reactions, describe structures in brackets
• Biology: _Scientific names_, describe diagrams with all labels

═══════════════════════════════════════════════════════════════════════════════
                              COMPUTER SCIENCE
═══════════════════════════════════════════════════════════════════════════════
• Code: Preserve syntax in code blocks
• Data structures: Arrays [a,b,c], Lists: A → B → NULL, Trees: indented
• Binary: 0b prefix, Hex: 0x prefix
• Big O: $O(n)$, $O(n^{2})$

═══════════════════════════════════════════════════════════════════════════════
                         TABLES (CRITICAL - MANDATORY PROCEDURE)
═══════════════════════════════════════════════════════════════════════════════
FOR EVERY TABLE:
1. COUNT columns first
2. IDENTIFY all headers
3. READ each row LEFT-TO-RIGHT, CELL BY CELL
4. VERIFY each row has correct number of cells

BINARY TABLES (0s and 1s):
• 0 = circular/oval shape (like letter O)
• 1 = vertical line (like letter I or l)
• Read EACH cell individually - NO pattern assumptions
• DOUBLE-CHECK every value before proceeding

Output format:
| Col1 | Col2 | Col3 |
|------|------|------|
| val  | val  | val  |

═══════════════════════════════════════════════════════════════════════════════
                    DIAGRAMS & VISUALS
═══════════════════════════════════════════════════════════════════════════════
Describe in detail within square brackets:
[DIAGRAM: <type> - Component list, labels, relationships, annotations]

═══════════════════════════════════════════════════════════════════════════════
                              INSTRUCTIONS
═══════════════════════════════════════════════════════════════════════════════
1. Process images in order (page ${startPage} first)
2. Separate pages with "--- Page X ---" markers
3. Use LaTeX ($...$) for math/science expressions
4. For unclear text: [uncertain: best guess]
5. Do NOT skip content - extract everything
6. Do NOT add commentary

OUTPUT: Return ONLY the extracted content from all images.`;

// Use QVQ-Max Vision for OCR
export async function extractTextFromBuffer(
  buffer: Buffer,
  mimeType: string
): Promise<OcrResult> {
  try {
    console.log(`Processing single image OCR with ${QVQ_MODEL}...`);

    const base64Data = buffer.toString("base64");
    const imageUrl = `${getMimePrefix(mimeType)}${base64Data}`;

    const text = await callQvqApi([
      {
        role: "user",
        content: [
          { type: "text", text: OCR_PROMPT_SINGLE },
          {
            type: "image_url",
            image_url: { url: imageUrl },
          },
        ],
      },
    ]);

    return {
      text: text,
      confidence: 95,
    };
  } catch (error) {
    console.error("OCR Error:", error);
    throw new Error("Failed to extract text from image");
  }
}

// Lightweight prompt for quick page number detection
const PAGE_DETECTION_PROMPT = `Find the PAGE NUMBER on this exam/answer sheet.

⚠️ CRITICAL: Look ONLY for actual PAGE NUMBERS, NOT question numbers!

PAGE NUMBERS are ONLY found in:
- Header area (top of page, usually small text)
- Footer area (bottom of page, usually small text)
- Page margins (edges of the paper)
- The SAME POSITION on every page (consistent location)

PAGE NUMBERS look like:
- "Page 1", "Page 2", "P.1", "Pg 2"
- "1/5", "2/5" (page X of Y format) - use the first number
- Just a standalone number in header/footer area: "1", "2", "3"
- Small printed text at top or bottom edge

⚠️ DO NOT CONFUSE WITH QUESTION NUMBERS:
- Question numbers appear INSIDE the main content area
- Question numbers are next to questions: "Q1", "Q2", "1.", "2.", "1a)", "2b)"
- Question numbers vary in position based on where questions are
- IGNORE all question numbers - they are NOT page numbers!

RULE: If a number appears next to question text or in the middle of the page, it is a QUESTION NUMBER, not a page number. Only look at the header/footer areas.

OUTPUT: Return ONLY a single number (1, 2, 3, etc.)
If you cannot find a PAGE NUMBER in header/footer, return: none`;

/**
 * Detect page number using Gemini 2.5 Flash (fast and cheap)
 * Used for sorting student submission pages before grading
 */
async function detectPageNumberWithGemini(
  buffer: Buffer,
  mimeType: string
): Promise<number | null> {
  try {
    const ai = getGeminiClient();
    const base64Data = buffer.toString("base64");

    const response = await ai.models.generateContent({
      model: GEMINI_PAGE_DETECTION_MODEL,
      contents: [
        {
          inlineData: {
            data: base64Data,
            mimeType: mimeType,
          },
        },
        PAGE_DETECTION_PROMPT,
      ],
    });

    const text = response.text?.toLowerCase() || "";

    // Parse the response
    if (text === "none" || text.includes("none") || text.includes("no page")) {
      return null;
    }

    // Extract number from response
    const match = text.match(/\d+/);
    if (match) {
      return parseInt(match[0], 10);
    }

    return null;
  } catch (error) {
    console.warn("Gemini page detection failed for an image:", error);
    return null;
  }
}

// Detect page number from a single image using QVQ-Max (legacy, for mark scheme)
async function detectPageNumber(
  buffer: Buffer,
  mimeType: string
): Promise<number | null> {
  try {
    const base64Data = buffer.toString("base64");
    const imageUrl = `${getMimePrefix(mimeType)}${base64Data}`;

    const text = await callQvqApi([
      {
        role: "user",
        content: [
          { type: "text", text: PAGE_DETECTION_PROMPT },
          {
            type: "image_url",
            image_url: { url: imageUrl },
          },
        ],
      },
    ]);

    const lowerText = text.toLowerCase();

    // Parse the response
    if (lowerText === "none" || lowerText.includes("none") || lowerText.includes("no page")) {
      return null;
    }

    // Extract number from response
    const match = lowerText.match(/\d+/);
    if (match) {
      return parseInt(match[0], 10);
    }

    return null;
  } catch {
    console.warn("Page detection failed for an image, will use original order");
    return null;
  }
}

// Interface for image with detected page info
interface ImageWithPage {
  buffer: Buffer;
  mimeType: string;
  detectedPage: number | null;
  originalIndex: number;
}

/**
 * Validate that detected page numbers are consecutive
 * Page numbers should form a sequence with no gaps (e.g., 2,3,4,5 not 2,5,8)
 * If not consecutive, they're likely question numbers mistaken for page numbers
 */
function validateConsecutivePages(pageNumbers: (number | null)[]): boolean {
  const validPages = pageNumbers.filter((p): p is number => p !== null);

  if (validPages.length <= 1) {
    return true; // Can't validate with 0-1 pages
  }

  // Sort and check for consecutive sequence
  const sorted = [...validPages].sort((a, b) => a - b);

  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i] - sorted[i - 1] !== 1) {
      // Gap detected - not consecutive
      console.warn(`Page numbers are not consecutive: ${sorted.join(", ")}`);
      console.warn(`Gap between ${sorted[i - 1]} and ${sorted[i]}`);
      return false;
    }
  }

  return true;
}

/**
 * Sort images by detected page numbers using Gemini 2.5 Flash (fast & cheap)
 *
 * This function ONLY detects page numbers and sorts images.
 * No OCR is performed - the sorted images are sent directly to grading.
 *
 * Pipeline: Student images → Gemini page detection → Sorted images → Gemini 2.5 Flash OCR
 *
 * VALIDATION: Page numbers must be consecutive (no gaps).
 * If pages 2,5,13 detected instead of 2,3,4 → likely question numbers, fall back to original order.
 */
export async function sortImagesByPageNumber(
  buffers: { buffer: Buffer; mimeType: string }[]
): Promise<PageSortResult> {
  try {
    console.log(`Sorting ${buffers.length} images by page number using Gemini...`);

    // If only one image, no need to detect page numbers
    if (buffers.length === 1) {
      return {
        sortedBuffers: buffers,
        sortedOriginalIndices: [0],
      };
    }

    // Detect page numbers from all images in parallel (Gemini is fast)
    const detectionPromises = buffers.map(async (img, index) => {
      const pageNum = await detectPageNumberWithGemini(img.buffer, img.mimeType);
      console.log(`  Image ${index + 1}: Detected page ${pageNum ?? "unknown"}`);
      return {
        buffer: img.buffer,
        mimeType: img.mimeType,
        detectedPage: pageNum,
        originalIndex: index,
      } as ImageWithPage;
    });

    const imagesWithPages = await Promise.all(detectionPromises);

    // Validate that detected page numbers are consecutive
    const detectedPages = imagesWithPages.map(img => img.detectedPage);
    const isConsecutive = validateConsecutivePages(detectedPages);

    if (!isConsecutive) {
      // Page numbers have gaps - likely detected question numbers instead
      // Fall back to original order
      console.warn("Detected page numbers are not consecutive - likely question numbers");
      console.warn("Falling back to original upload order");
      return {
        sortedBuffers: buffers,
        sortedOriginalIndices: buffers.map((_, i) => i),
      };
    }

    // Sort: detected pages first (ascending), then unknown pages (by original order)
    imagesWithPages.sort((a, b) => {
      // Both have page numbers - sort numerically
      if (a.detectedPage !== null && b.detectedPage !== null) {
        return a.detectedPage - b.detectedPage;
      }
      // Only a has page number - a comes first
      if (a.detectedPage !== null && b.detectedPage === null) {
        return -1;
      }
      // Only b has page number - b comes first
      if (a.detectedPage === null && b.detectedPage !== null) {
        return 1;
      }
      // Neither has page number - maintain original order
      return a.originalIndex - b.originalIndex;
    });

    // Extract the sorted order
    const sortedOriginalIndices = imagesWithPages.map(img => img.originalIndex);
    const sortedBuffers = imagesWithPages.map(img => ({
      buffer: img.buffer,
      mimeType: img.mimeType,
    }));

    // Log the sorted order
    console.log("Sorted page order:", imagesWithPages.map(img =>
      img.detectedPage ?? `unknown(orig:${img.originalIndex + 1})`
    ).join(", "));

    return {
      sortedBuffers,
      sortedOriginalIndices,
    };
  } catch (error) {
    console.error("Page sorting error:", error);
    // Fallback: return original order
    console.warn("Falling back to original order");
    return {
      sortedBuffers: buffers,
      sortedOriginalIndices: buffers.map((_, i) => i),
    };
  }
}

// Prompt for extracting ONLY handwritten content from student answer sheets
const HANDWRITTEN_ONLY_OCR_PROMPT = `You are an expert OCR system. Extract ONLY HANDWRITTEN content from a student's answer sheet.

╔═══════════════════════════════════════════════════════════════════════════════╗
║              ⚠️ ABSOLUTE RULE: EXTRACT *ONLY* HANDWRITTEN CONTENT ⚠️           ║
╚═══════════════════════════════════════════════════════════════════════════════╝

HANDWRITTEN text characteristics:
• Irregular letter shapes - no two letters exactly the same
• Variable stroke thickness from pen pressure
• Inconsistent spacing, slight slant
• Visible pen/pencil strokes with natural flow
• May have corrections or cross-outs

PRINTED text (DO NOT EXTRACT):
• Perfectly uniform letters
• Consistent spacing and alignment
• Standard fonts, machine-perfect appearance

═══════════════════════════════════════════════════════════════════════════════
                              WHAT TO EXTRACT
═══════════════════════════════════════════════════════════════════════════════

✅ EXTRACT:
• Student's handwritten answers - INCLUDE ALL PARTS
• Handwritten calculations and working - EVERY STEP
• Handwritten diagrams/graphs (describe them EXHAUSTIVELY - every element!)
• Content written in blanks/boxes
• Which options were circled/ticked (just note "B" not the option text)
• Question numbers (Q1, Q2, etc.) for organization only
• ANY handwritten content, even crossed out or corrected

❌ DO NOT EXTRACT:
• Printed question text ("Calculate the...", "Solve...")
• Printed instructions
• Printed headers/footers
• Printed multiple choice option text
• Any perfectly uniform machine text

═══════════════════════════════════════════════════════════════════════════════
                    ⚠️ COMPLETENESS IS CRITICAL ⚠️
═══════════════════════════════════════════════════════════════════════════════

DO NOT skip or summarize ANY handwritten content!

For EACH question, extract:
1. The FULL answer exactly as written
2. ALL working/calculations (every step, every number)
3. ALL parts of multi-part answers (a, b, c, i, ii, iii, etc.)
4. ANY additional notes or explanations student added

BETTER TO OVER-EXTRACT than to miss something!

═══════════════════════════════════════════════════════════════════════════════
                              EXAMPLES
═══════════════════════════════════════════════════════════════════════════════

Example 1 - Math:
[PRINTED] Q3. Solve x² + 5x + 6 = 0
[HANDWRITTEN] (x+2)(x+3)=0, x=-2 or x=-3

CORRECT OUTPUT:
**Q3**: (x+2)(x+3)=0, x=-2 or x=-3

WRONG OUTPUT:
**Q3**: Solve x² + 5x + 6 = 0... ← NO printed text!

Example 2 - Fill in blank:
[PRINTED] The capital of France is ___
[HANDWRITTEN] Paris

CORRECT: **Q[num]**: Paris
WRONG: The capital of France is Paris ← NO printed text!

Example 3 - MCQ:
[PRINTED] A. Nitrogen B. Carbon C. Oxygen D. Boron
[HANDWRITTEN circle on B]

CORRECT: **Q[num]**: B
WRONG: B. Carbon ← NO option text!

Example 4 - Multi-part (MUST INCLUDE ALL PARTS):
[HANDWRITTEN across multiple areas]
Part a: 5 + 3 = 8
Part b: 8 × 2 = 16
Part c: 16 ÷ 4 = 4

CORRECT:
**Q[num]a**: 5 + 3 = 8
**Q[num]b**: 8 × 2 = 16
**Q[num]c**: 16 ÷ 4 = 4

WRONG (missing parts):
**Q[num]**: 8 ← incomplete!

═══════════════════════════════════════════════════════════════════════════════
                              MATH FORMATTING
═══════════════════════════════════════════════════════════════════════════════

Use LaTeX for math expressions: $...$
• Fractions: $\\frac{a}{b}$
• Powers: $x^{2}$
• Roots: $\\sqrt{x}$
• Greek: $\\alpha, \\beta, \\theta, \\pi$

═══════════════════════════════════════════════════════════════════════════════
                    ⚠️ BOOLEAN ALGEBRA - CRITICAL ⚠️
═══════════════════════════════════════════════════════════════════════════════

For boolean/logic expressions, be VERY CAREFUL with NOT/overline notation:

ONLY use overline $\\overline{X}$ when you ACTUALLY SEE a line drawn above the variable!

Visual identification:
• $\\overline{A}$ = A with a horizontal line DRAWN ABOVE it (NOT A, A-bar)
• $A$ = just the letter A with NO line above it

⚠️ COMMON MISTAKE: Adding overlines where none exist!
If you see just "A" written, output $A$ NOT $\\overline{A}$
If you see "A" with a line above it, output $\\overline{A}$

Examples:
• Student writes: AB + C → Output: $AB + C$ (no overlines unless drawn)
• Student writes: A̅B + C → Output: $\\overline{A}B + C$ (overline only on A)
• Student writes: A̅B̅ + C̅ → Output: $\\overline{A}\\overline{B} + \\overline{C}$

DO NOT assume or add overlines that aren't visually present!

═══════════════════════════════════════════════════════════════════════════════
                    ⚠️ BINARY/TRUTH TABLES - CRITICAL ⚠️
═══════════════════════════════════════════════════════════════════════════════

For tables with 0s and 1s, follow this STRICT procedure:

STEP 1: Count the EXACT number of columns
STEP 2: Identify ALL column headers
STEP 3: For EACH row, read EACH cell LEFT-TO-RIGHT, one at a time
STEP 4: VERIFY you have the correct number of cells per row
STEP 5: Double-check EVERY value before moving to next row

Visual identification:
• 0 = CIRCULAR/OVAL closed shape (looks like letter O)
• 1 = VERTICAL LINE (looks like letter I, l, or |)

⚠️ FOR LONG TABLES (8+ rows):
• SLOW DOWN - do not rush
• Read each row independently - don't assume patterns
• After completing the table, RE-READ each row to verify
• Common mistake: confusing rows or skipping values

Output format:
| A | B | C | Output |
|---|---|---|--------|
| 0 | 0 | 0 |   0    |
| 0 | 0 | 1 |   1    |
[continue for ALL rows]

═══════════════════════════════════════════════════════════════════════════════
                    DIAGRAMS & GRAPHS - EXHAUSTIVE DESCRIPTION
═══════════════════════════════════════════════════════════════════════════════

For ANY handwritten diagram or graph, provide COMPLETE description - MISS NOTHING!

[DIAGRAM: <type>]
┌─ Overview: <what is this diagram showing?>
├─ Components: <list EVERY element with position, labels, values>
│   • Element 1: <name, position (top-left, center, etc.), size, any values>
│   • Element 2: <name, position, any labels written nearby>
│   • ... (continue for ALL visible elements)
├─ Connections: <how elements connect, direction of arrows/lines, flow>
├─ Labels: <ALL text/numbers written on or near diagram>
├─ Annotations: <any notes, arrows, highlights, crossed-out parts>
└─ Missing elements: <if student left parts incomplete, note them>

[GRAPH: <type>]
┌─ Type: <line graph, bar chart, scatter plot, etc.>
├─ X-axis: <label, range (min to max), units, scale>
├─ Y-axis: <label, range (min to max), units, scale>
├─ Data points: <list ALL visible points with coordinates>
├─ Curves/Lines: <describe shape, direction, intersections>
├─ Labels: <ALL annotations, titles, legends>
└─ Key features: <maxima, minima, asymptotes, intercepts>

EXAMPLE - Circuit:
[DIAGRAM: Series circuit]
┌─ Overview: Simple series circuit with power source and components
├─ Components:
│   • Battery (9V, top-left corner, positive terminal facing right)
│   • Resistor R1 (100Ω, top-right, zigzag symbol ~2cm long)
│   • LED (bottom-right, standard diode symbol, arrow pointing down)
│   • Switch S1 (bottom-left, shown in OPEN position)
├─ Connections: Clockwise loop: Battery+ → R1 → LED → S1 → Battery-
├─ Labels: "9V" written above battery, "R1=100Ω" next to resistor, "LED" below diode
├─ Annotations: Arrow showing current direction labeled "I"
└─ Missing: None - circuit appears complete

⚠️ CRITICAL: DO NOT give brief descriptions!
• If you see a circuit, describe EVERY component
• If you see a graph, list EVERY data point you can read
• If you see a flowchart, describe EVERY box and arrow
• If ANYTHING is drawn, describe it - even if messy or incomplete

═══════════════════════════════════════════════════════════════════════════════
                              OUTPUT FORMAT
═══════════════════════════════════════════════════════════════════════════════

⚠️ CRITICAL: Output ONLY what the STUDENT WROTE - this will be graded as their answer!
DO NOT include any question text, instructions, or printed content.

For EACH question, output in this format:

**Q[number]**: [ONLY the student's handwritten answer]
[If working shown]: **Working**: [student's calculation steps]
[If diagram present]: [DIAGRAM: ...student's drawing described...]

If blank: **Q[number]**: [BLANK - no answer]
If unclear: [unclear: best guess]

EXAMPLE - CORRECT:
---
**Q1**: $x = 5$
**Working**: $2x + 3 = 13$, $2x = 10$, $x = 5$

**Q2a**: B

**Q2b**: Photosynthesis converts light energy into glucose.

**Q3**:
[DIAGRAM: Circuit - Battery (9V) connected to Resistor (100Ω) in series]

**Q4**: [BLANK - no answer]
---

EXAMPLE - WRONG (includes question text):
---
**Q1**: Solve for x: 2x + 3 = 13. x = 5  ← WRONG! "Solve for x: 2x + 3 = 13" is printed!
---

The grader will compare YOUR OUTPUT against the mark scheme.
If you include question text, the grader might think the student wrote it!

FINAL CHECK:
- Does any text look machine-printed? → REMOVE IT
- Am I including question text? → REMOVE IT
- Did I only include what the STUDENT actually wrote? → Good
- Did I include ALL parts (a, b, c, i, ii)? → Check again

OUTPUT: Return ONLY the student's HANDWRITTEN answers, organized by question number.`;

/**
 * Extract ONLY handwritten content from a single student answer sheet image
 * Uses Gemini 2.5 Flash for fast and reliable handwriting recognition
 */
async function extractHandwrittenFromImage(
  buffer: Buffer,
  mimeType: string,
  pageNumber: number
): Promise<string> {
  try {
    const base64Data = buffer.toString("base64");

    const prompt = `${HANDWRITTEN_ONLY_OCR_PROMPT}

This is page ${pageNumber} of the student's answer sheet.`;

    console.log(`  Using Gemini 2.5 Flash for page ${pageNumber}...`);

    const ai = getGeminiClient();
    const response = await ai.models.generateContent({
      model: GEMINI_PRO_OCR_MODEL,
      contents: [
        {
          role: "user",
          parts: [
            { text: prompt },
            {
              inlineData: {
                mimeType: mimeType,
                data: base64Data,
              },
            },
          ],
        },
      ],
    });

    return response.text || "";
  } catch (error) {
    console.error(`Failed to extract handwritten content from page ${pageNumber}:`, error);
    return `[Error extracting page ${pageNumber}]`;
  }
}

/**
 * Extract handwritten content from student submission images
 * 1. Sorts images by page number (using Gemini 2.0 Flash Lite)
 * 2. Extracts ONLY handwritten content from each page (using Gemini 2.5 Flash)
 *
 * Returns: sorted image indices + combined extracted text
 */
export async function extractHandwrittenFromSubmission(
  buffers: { buffer: Buffer; mimeType: string }[]
): Promise<OcrResultWithOrder> {
  try {
    console.log(`Processing ${buffers.length} student images for handwritten OCR...`);

    // Step 1: Sort images by page number
    const sortResult = await sortImagesByPageNumber(buffers);
    console.log(`Images sorted: ${sortResult.sortedOriginalIndices.join(", ")}`);

    // Step 2: Extract handwritten content from each sorted image
    const extractedTexts: string[] = [];

    for (let i = 0; i < sortResult.sortedBuffers.length; i++) {
      const pageNumber = i + 1;
      console.log(`  Extracting handwritten content from page ${pageNumber}...`);

      const text = await extractHandwrittenFromImage(
        sortResult.sortedBuffers[i].buffer,
        sortResult.sortedBuffers[i].mimeType,
        pageNumber
      );

      extractedTexts.push(`--- Page ${pageNumber} ---\n${text}`);
    }

    const combinedText = extractedTexts.join("\n\n");

    return {
      text: combinedText,
      confidence: 95,
      sortedOriginalIndices: sortResult.sortedOriginalIndices,
    };
  } catch (error) {
    console.error("Handwritten extraction error:", error);
    throw new Error("Failed to extract handwritten content from submission");
  }
}

// Extract text from multiple images and combine them
// Images are automatically sorted by detected page numbers
// Returns the sorted order so images can be reordered in the UI
export async function extractTextFromMultipleBuffers(
  buffers: { buffer: Buffer; mimeType: string }[]
): Promise<OcrResultWithOrder> {
  try {
    console.log(`Processing ${buffers.length} images for OCR with ${QVQ_MODEL}...`);

    // ═══════════════════════════════════════════════════════════════════════════
    // PHASE 1: Detect page numbers from all images (parallel for speed)
    // ═══════════════════════════════════════════════════════════════════════════
    console.log("Phase 1: Detecting page numbers...");

    const detectionPromises = buffers.map(async (img, index) => {
      const pageNum = await detectPageNumber(img.buffer, img.mimeType);
      console.log(`  Image ${index + 1}: Detected page ${pageNum ?? "unknown"}`);
      return {
        buffer: img.buffer,
        mimeType: img.mimeType,
        detectedPage: pageNum,
        originalIndex: index,
      } as ImageWithPage;
    });

    const imagesWithPages = await Promise.all(detectionPromises);

    // ═══════════════════════════════════════════════════════════════════════════
    // PHASE 2: Sort images by page number
    // ═══════════════════════════════════════════════════════════════════════════
    console.log("Phase 2: Sorting images by page number...");

    // Sort: detected pages first (ascending), then unknown pages (by original order)
    imagesWithPages.sort((a, b) => {
      // Both have page numbers - sort numerically
      if (a.detectedPage !== null && b.detectedPage !== null) {
        return a.detectedPage - b.detectedPage;
      }
      // Only a has page number - a comes first
      if (a.detectedPage !== null && b.detectedPage === null) {
        return -1;
      }
      // Only b has page number - b comes first
      if (a.detectedPage === null && b.detectedPage !== null) {
        return 1;
      }
      // Neither has page number - maintain original order
      return a.originalIndex - b.originalIndex;
    });

    // Extract the sorted order of original indices
    const sortedOriginalIndices = imagesWithPages.map(img => img.originalIndex);

    // Log the sorted order
    console.log("Sorted page order:", imagesWithPages.map(img =>
      img.detectedPage ?? `unknown(orig:${img.originalIndex + 1})`
    ).join(", "));
    console.log("Original indices in sorted order:", sortedOriginalIndices.join(", "));

    // ═══════════════════════════════════════════════════════════════════════════
    // PHASE 3: Process sorted images in batches
    // ═══════════════════════════════════════════════════════════════════════════
    console.log("Phase 3: Processing OCR on sorted images...");

    const batches = chunkArray(imagesWithPages, BATCH_SIZE);
    const batchResults: string[] = [];

    for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
      const batch = batches[batchIndex];
      const startPage = batchIndex * BATCH_SIZE + 1;
      const endPage = startPage + batch.length - 1;

      console.log(`Processing OCR batch ${batchIndex + 1}/${batches.length} (sorted positions ${startPage}-${endPage})...`);

      const prompt = OCR_PROMPT_BATCH(startPage, endPage, batchIndex + 1, batches.length);

      // Build content array with text and all images
      const content: Array<{type: string; text?: string; image_url?: {url: string}}> = [
        { type: "text", text: prompt },
      ];

      for (const { buffer, mimeType } of batch) {
        const base64Data = buffer.toString("base64");
        const imageUrl = `${getMimePrefix(mimeType)}${base64Data}`;
        content.push({
          type: "image_url",
          image_url: { url: imageUrl },
        });
      }

      const text = await callQvqApi([
        {
          role: "user",
          content: content,
        },
      ]);

      batchResults.push(text);
    }

    // Combine all batch results
    const combinedText = batchResults.join("\n\n---\n\n");

    return {
      text: combinedText,
      confidence: 95,
      sortedOriginalIndices,
    };
  } catch (error) {
    console.error("OCR Error:", error);
    throw new Error("Failed to extract text from images");
  }
}

// Supported mark scheme file types
export const SUPPORTED_MARK_SCHEME_TYPES = {
  // PDFs
  "application/pdf": ".pdf",
  // Images
  "image/png": ".png",
  "image/jpeg": ".jpg",
  "image/jpg": ".jpg",
  "image/gif": ".gif",
  "image/webp": ".webp",
  // Word documents
  "application/msword": ".doc",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ".docx",
  // Excel spreadsheets
  "application/vnd.ms-excel": ".xls",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": ".xlsx",
};

// Get file extension from MIME type
export function getExtensionFromMimeType(mimeType: string): string | null {
  return SUPPORTED_MARK_SCHEME_TYPES[mimeType as keyof typeof SUPPORTED_MARK_SCHEME_TYPES] || null;
}

// Check if file type is supported
export function isSupportedMarkSchemeType(mimeType: string): boolean {
  return mimeType in SUPPORTED_MARK_SCHEME_TYPES;
}

// The mark scheme extraction prompt for documents (PDF, Word, Excel)
// Comprehensive LaTeX-based extraction with structure preservation
const MARK_SCHEME_PROMPT = `You are an expert OCR system extracting a MARK SCHEME document with MAXIMUM FIDELITY.
Your output must preserve the EXACT structure and format of the original document using LaTeX notation.

╔═══════════════════════════════════════════════════════════════════════════════╗
║                    CRITICAL: OUTPUT FORMAT REQUIREMENTS                        ║
╚═══════════════════════════════════════════════════════════════════════════════╝

1. ALL mathematical expressions MUST be in LaTeX: $..$ for inline, $$...$$ for display
2. ALL tables MUST be in LaTeX tabular format
3. ALL chemical equations MUST use LaTeX chemistry notation
4. Visuals/diagrams that CANNOT be expressed in LaTeX → provide EXHAUSTIVE descriptions
5. Mark expected answers with: ★EXPECTED: [answer in LaTeX]★

╔═══════════════════════════════════════════════════════════════════════════════╗
║                         MATHEMATICAL EXPRESSIONS                               ║
╚═══════════════════════════════════════════════════════════════════════════════╝

ALWAYS use LaTeX for ANY mathematical content:

ARITHMETIC & ALGEBRA:
• Fractions: $\\frac{a}{b}$, $\\frac{x+1}{x-1}$, $\\dfrac{\\partial f}{\\partial x}$
• Powers/Exponents: $x^{2}$, $e^{x}$, $2^{n+1}$, $a^{b^{c}}$
• Subscripts: $x_{1}$, $a_{n}$, $v_{0}$, $x_{i,j}$
• Roots: $\\sqrt{x}$, $\\sqrt[3]{8}$, $\\sqrt[n]{a}$
• Absolute value: $|x|$, $\\left|\\frac{a}{b}\\right|$

GREEK LETTERS:
• Lowercase: $\\alpha, \\beta, \\gamma, \\delta, \\epsilon, \\zeta, \\eta, \\theta$
• Lowercase: $\\iota, \\kappa, \\lambda, \\mu, \\nu, \\xi, \\pi, \\rho$
• Lowercase: $\\sigma, \\tau, \\upsilon, \\phi, \\chi, \\psi, \\omega$
• Uppercase: $\\Gamma, \\Delta, \\Theta, \\Lambda, \\Xi, \\Pi, \\Sigma, \\Phi, \\Psi, \\Omega$

CALCULUS:
• Derivatives: $\\frac{d}{dx}$, $\\frac{dy}{dx}$, $f'(x)$, $f''(x)$, $\\frac{d^2y}{dx^2}$
• Partial: $\\frac{\\partial f}{\\partial x}$, $\\nabla f$, $\\nabla^2 f$
• Integrals: $\\int f(x)\\,dx$, $\\int_{a}^{b} f(x)\\,dx$, $\\iint$, $\\iiint$, $\\oint$
• Limits: $\\lim_{x \\to a} f(x)$, $\\lim_{n \\to \\infty}$
• Summation: $\\sum_{i=1}^{n} a_i$, $\\prod_{i=1}^{n}$

MATRICES & VECTORS:
• Matrix: $\\begin{pmatrix} a & b \\\\ c & d \\end{pmatrix}$
• Determinant: $\\begin{vmatrix} a & b \\\\ c & d \\end{vmatrix}$
• Bracket matrix: $\\begin{bmatrix} 1 & 2 \\\\ 3 & 4 \\end{bmatrix}$
• Vectors: $\\vec{v}$, $\\mathbf{v}$, $\\overrightarrow{AB}$, $\\hat{i}$, $\\hat{j}$, $\\hat{k}$

SET THEORY & LOGIC:
• Sets: $\\in, \\notin, \\subset, \\subseteq, \\supset, \\supseteq$
• Operations: $\\cup, \\cap, \\setminus, \\emptyset, \\varnothing$
• Logic: $\\forall, \\exists, \\nexists, \\neg, \\land, \\lor, \\implies, \\iff$
• Quantifiers: $\\therefore, \\because$

⚠️ BOOLEAN ALGEBRA - CRITICAL:
• Overline (NOT): $\\overline{A}$ - ONLY when a line is VISUALLY DRAWN above the variable
• If no line above: just $A$ (DO NOT add overline if not present!)
• AND: $A \\cdot B$ or $AB$
• OR: $A + B$
• XOR: $A \\oplus B$
• NAND: $\\overline{A \\cdot B}$ (only if overline is drawn over the entire expression)

RELATIONS & OPERATORS:
• Comparison: $\\leq, \\geq, \\neq, \\approx, \\equiv, \\sim, \\propto$
• Arrows: $\\rightarrow, \\leftarrow, \\leftrightarrow, \\Rightarrow, \\Leftarrow, \\Leftrightarrow$
• Special: $\\infty, \\pm, \\mp, \\times, \\div, \\cdot, \\circ$

TRIGONOMETRY:
• Functions: $\\sin, \\cos, \\tan, \\cot, \\sec, \\csc$
• Inverse: $\\arcsin, \\arccos, \\arctan$ or $\\sin^{-1}, \\cos^{-1}, \\tan^{-1}$
• Hyperbolic: $\\sinh, \\cosh, \\tanh$

LOGARITHMS & EXPONENTIALS:
• $\\log x$, $\\log_{10} x$, $\\log_{b} x$, $\\ln x$, $\\exp(x)$, $e^{x}$

╔═══════════════════════════════════════════════════════════════════════════════╗
║                              TABLES (LaTeX FORMAT)                             ║
╚═══════════════════════════════════════════════════════════════════════════════╝

ALL tables MUST be output in LaTeX tabular format. NEVER use markdown tables.

EXAMPLE - Simple table:
$$\\begin{array}{|c|c|c|}
\\hline
\\textbf{Column 1} & \\textbf{Column 2} & \\textbf{Column 3} \\\\
\\hline
Value 1 & Value 2 & Value 3 \\\\
Value 4 & Value 5 & Value 6 \\\\
\\hline
\\end{array}$$

EXAMPLE - Truth table:
$$\\begin{array}{|c|c|c|c|}
\\hline
A & B & A \\land B & A \\lor B \\\\
\\hline
0 & 0 & 0 & 0 \\\\
0 & 1 & 0 & 1 \\\\
1 & 0 & 0 & 1 \\\\
1 & 1 & 1 & 1 \\\\
\\hline
\\end{array}$$

EXAMPLE - Data table with units:
$$\\begin{array}{|l|r|r|}
\\hline
\\textbf{Substance} & \\textbf{Mass (g)} & \\textbf{Volume (cm}^3\\textbf{)} \\\\
\\hline
Water & 100 & 100 \\\\
Ethanol & 79 & 100 \\\\
Mercury & 1360 & 100 \\\\
\\hline
\\end{array}$$

TABLE EXTRACTION RULES:
1. Count columns EXACTLY before starting
2. Read each cell LEFT-TO-RIGHT, TOP-TO-BOTTOM, ONE CELL AT A TIME
3. VERIFY each row has the correct number of cells
4. Preserve ALL headers, units, and formatting
5. Use \\textbf{} for bold headers
6. Use \\hline for horizontal lines
7. Align: |l| = left, |c| = center, |r| = right

⚠️ BINARY/TRUTH TABLES - CRITICAL:
• 0 = CIRCULAR/OVAL shape (like letter O)
• 1 = VERTICAL LINE (like letter I, l, or |)
• For LONG tables (8+ rows): SLOW DOWN, read each row independently
• DO NOT assume patterns - read each value individually
• After completing: RE-READ the entire table to verify accuracy
• Common error: confusing rows or misreading 0 as 1

╔═══════════════════════════════════════════════════════════════════════════════╗
║                           CHEMISTRY (LaTeX FORMAT)                             ║
╚═══════════════════════════════════════════════════════════════════════════════╝

Chemical formulas: $\\text{H}_2\\text{O}$, $\\text{CO}_2$, $\\text{C}_6\\text{H}_{12}\\text{O}_6$
Ions: $\\text{Fe}^{3+}$, $\\text{SO}_4^{2-}$, $\\text{OH}^{-}$
Equations: $2\\text{H}_2 + \\text{O}_2 \\rightarrow 2\\text{H}_2\\text{O}$
Equilibrium: $\\text{N}_2 + 3\\text{H}_2 \\rightleftharpoons 2\\text{NH}_3$
State symbols: $(s)$, $(l)$, $(g)$, $(aq)$
Electron config: $1s^2 2s^2 2p^6 3s^2 3p^6$

╔═══════════════════════════════════════════════════════════════════════════════╗
║                           PHYSICS (LaTeX FORMAT)                               ║
╚═══════════════════════════════════════════════════════════════════════════════╝

Equations: $F = ma$, $E = mc^2$, $E = \\frac{1}{2}mv^2$
Units: $9.8\\ \\text{m/s}^2$, $6.67 \\times 10^{-11}\\ \\text{N}\\cdot\\text{m}^2/\\text{kg}^2$
Vectors: $\\vec{F}$, $\\vec{v}$, $\\vec{a}$, $|\\vec{F}| = F$
Constants: $c = 3 \\times 10^8\\ \\text{m/s}$, $g = 9.81\\ \\text{m/s}^2$

╔═══════════════════════════════════════════════════════════════════════════════╗
║                    DIAGRAMS & VISUALS (DETAILED DESCRIPTION)                   ║
╚═══════════════════════════════════════════════════════════════════════════════╝

For ANY visual element that CANNOT be expressed in LaTeX, provide an EXHAUSTIVE description:

[DIAGRAM: <TYPE>]
├── Overall Structure: <describe the complete layout>
├── Components:
│   ├── Component 1: <name, position, size, color, shape>
│   ├── Component 2: <name, position, size, color, shape>
│   └── ...
├── Connections/Relationships:
│   ├── <describe how components connect>
│   └── <describe flow direction, arrows, lines>
├── Labels & Annotations:
│   ├── <list ALL text labels with their positions>
│   └── <list ALL numerical values shown>
├── Axes (if graph):
│   ├── X-axis: <label, range, units, scale>
│   ├── Y-axis: <label, range, units, scale>
│   └── Data points: <list coordinates or describe curves>
├── Colors & Styling:
│   └── <describe any significant colors or patterns>
└── Additional Details: <anything else visible>

EXAMPLES:

[DIAGRAM: CIRCUIT]
├── Overall Structure: Series circuit with 3 components in a rectangular loop
├── Components:
│   ├── Battery: 9V cell at top-left, positive terminal marked with +
│   ├── Resistor R1: 100Ω resistor at top-right, standard zigzag symbol
│   ├── LED: Red LED at bottom-right, arrow pointing down indicating current direction
│   └── Switch S1: Open switch at bottom-left
├── Connections: Clockwise from battery positive terminal
├── Labels: "9V" near battery, "R1 = 100Ω" near resistor, "LED" below diode
└── Current direction: Clockwise when switch closed

[DIAGRAM: GRAPH]
├── Overall Structure: Cartesian coordinate system with plotted curve
├── Axes:
│   ├── X-axis: "Time (s)", range 0-10, major gridlines every 2s
│   ├── Y-axis: "Velocity (m/s)", range 0-50, major gridlines every 10 m/s
├── Data:
│   ├── Curve type: Exponential growth approaching asymptote
│   ├── Key points: (0, 0), (2, 15), (4, 30), (6, 40), (8, 45), (10, 48)
│   └── Asymptote: Dashed horizontal line at y = 50
├── Labels: "Terminal velocity" pointing to asymptote
└── Style: Solid blue curve, black axes, gray gridlines

╔═══════════════════════════════════════════════════════════════════════════════╗
║                         EXPECTED ANSWERS MARKING                               ║
║              ⚠️ CRITICAL: SEPARATE QUESTION TEXT FROM ANSWERS ⚠️               ║
╚═══════════════════════════════════════════════════════════════════════════════╝

Mark ONLY what STUDENTS ARE EXPECTED TO WRITE with: ★EXPECTED: [answer]★

⚠️ CRITICAL DISTINCTION:
┌─────────────────────────────────────────────────────────────────────────────┐
│ PRE-PRINTED/GIVEN TEXT = Text already on the question paper                  │
│                          Students do NOT write this                          │
│                          DO NOT mark as expected                             │
├─────────────────────────────────────────────────────────────────────────────┤
│ EXPECTED ANSWER = Only what STUDENTS must write/fill in                      │
│                   This is the ONLY thing to mark with ★EXPECTED:...★        │
└─────────────────────────────────────────────────────────────────────────────┘

EXAMPLES - Getting it RIGHT:

Example 1 - Fill in blank:
Mark scheme shows: "The capital of France is Paris"
• "The capital of France is" = PRE-PRINTED (don't mark)
• "Paris" = EXPECTED ANSWER
CORRECT: ★EXPECTED: Paris★
WRONG: ★EXPECTED: The capital of France is Paris★ ← includes pre-printed text!

Example 2 - Definition question:
Q: "Define photosynthesis"  ← PRE-PRINTED question
A: "The process by which plants convert..."
CORRECT: ★EXPECTED: The process by which plants convert light energy into chemical energy★
WRONG: Including "Define photosynthesis" in expected answer

Example 3 - Calculation:
Q: "Calculate 5 × 3"  ← PRE-PRINTED
A: "15"
CORRECT: ★EXPECTED: $15$★ (just the answer)
WRONG: ★EXPECTED: 5 × 3 = 15★ ← includes the given numbers!

Example 4 - Truth table (student fills in OUTPUT column only):
Given: A | B | OUTPUT
       0 | 0 |   ?
       0 | 1 |   ?
• A and B columns = PRE-PRINTED (given to students)
• OUTPUT column = EXPECTED (what students fill in)
CORRECT: Mark only the OUTPUT values as expected

HOW TO IDENTIFY:
• Pre-printed = Question text, given values, table headers, instructions
• Expected = Blank spaces to fill, answer boxes, solution steps

The answer inside ★EXPECTED:...★ MUST be in LaTeX when applicable:
• ★EXPECTED: $x = 5$★
• ★EXPECTED: $\\frac{3}{4}$★
• ★EXPECTED: $\\text{H}_2\\text{O}$★
• ★EXPECTED: photosynthesis★ (text answers)

╔═══════════════════════════════════════════════════════════════════════════════╗
║                            EXTRACTION RULES                                    ║
╚═══════════════════════════════════════════════════════════════════════════════╝

1. Extract EVERYTHING - leave NOTHING out
2. Preserve EXACT document structure (sections, numbering, hierarchy)
3. ALL math/science → LaTeX format
4. ALL tables → LaTeX tabular format
5. ALL diagrams → exhaustive [DIAGRAM: ...] descriptions
6. ALL expected answers → ★EXPECTED: ...★ markers
7. Include mark allocations: [2 marks], M1, A1, B1, etc.
8. Preserve question numbering: Q1, Q2, (a), (b), (i), (ii), etc.
9. Do NOT add explanations or commentary
10. Do NOT summarize - extract VERBATIM

OUTPUT: Return the COMPLETE mark scheme in LaTeX format with all expected answers marked.`;

// Extract text from Word documents using mammoth
async function extractTextFromWord(buffer: Buffer): Promise<string> {
  try {
    const result = await mammoth.extractRawText({ buffer });
    return result.value;
  } catch (error) {
    console.error("Word extraction error:", error);
    throw new Error("Failed to extract text from Word document");
  }
}

// Extract text from Excel files using xlsx
function extractTextFromExcel(buffer: Buffer): string {
  try {
    const workbook = XLSX.read(buffer, { type: "buffer" });
    const sheets: string[] = [];

    for (const sheetName of workbook.SheetNames) {
      const sheet = workbook.Sheets[sheetName];
      const text = XLSX.utils.sheet_to_txt(sheet);
      sheets.push(`=== Sheet: ${sheetName} ===\n${text}`);
    }

    return sheets.join("\n\n");
  } catch (error) {
    console.error("Excel extraction error:", error);
    throw new Error("Failed to extract text from Excel file");
  }
}

// Check if file type can be sent directly to QVQ-Max (images)
function isVisionSupportedType(mimeType: string): boolean {
  const visionTypes = [
    "image/png",
    "image/jpeg",
    "image/jpg",
    "image/gif",
    "image/webp",
  ];
  return visionTypes.includes(mimeType);
}

// Check if it's a PDF
function isPdfType(mimeType: string): boolean {
  return mimeType === "application/pdf";
}

// Check if it's a Word document
function isWordDocument(mimeType: string): boolean {
  return mimeType === "application/msword" ||
    mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
}

// Check if it's an Excel document
function isExcelDocument(mimeType: string): boolean {
  return mimeType === "application/vnd.ms-excel" ||
    mimeType === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
}

// Extract text from any supported mark scheme file type
export async function extractTextFromMarkSchemeFile(
  buffer: Buffer,
  mimeType: string
): Promise<string> {
  try {
    // Handle Word documents
    if (isWordDocument(mimeType)) {
      console.log("Extracting text from Word document...");
      return await extractTextFromWord(buffer);
    }

    // Handle Excel documents
    if (isExcelDocument(mimeType)) {
      console.log("Extracting text from Excel document...");
      return extractTextFromExcel(buffer);
    }

    // Handle images with QVQ-Max Vision
    if (isVisionSupportedType(mimeType)) {
      console.log(`Processing mark scheme extraction for ${mimeType} with ${QVQ_MODEL}...`);

      const base64Data = buffer.toString("base64");
      const imageUrl = `${getMimePrefix(mimeType)}${base64Data}`;

      const text = await callQvqApi([
        {
          role: "user",
          content: [
            { type: "text", text: MARK_SCHEME_PROMPT },
            {
              type: "image_url",
              image_url: { url: imageUrl },
            },
          ],
        },
      ]);

      return text;
    }

    // Handle PDFs with Gemini 2.5 Pro (best quality extraction)
    if (isPdfType(mimeType)) {
      console.log(`Processing PDF mark scheme extraction with Gemini 2.5 Pro...`);

      const ai = getGeminiClient();
      const base64Data = buffer.toString("base64");

      const response = await ai.models.generateContent({
        model: GEMINI_PRO_OCR_MODEL,
        contents: [
          {
            inlineData: {
              data: base64Data,
              mimeType: "application/pdf",
            },
          },
          MARK_SCHEME_PROMPT,
        ],
      });

      return response.text || "";
    }

    throw new Error(`Unsupported file type: ${mimeType}`);
  } catch (error) {
    console.error("Mark scheme extraction error:", error);
    throw new Error(`Failed to extract text from ${mimeType} file`);
  }
}

// Extract text from multiple mark scheme files of various types
export async function extractTextFromMultipleMarkSchemeFiles(
  files: { buffer: Buffer; mimeType: string; filename: string }[]
): Promise<string> {
  try {
    console.log(`Processing ${files.length} mark scheme files...`);

    const extractedTexts: string[] = [];

    // Process each file individually based on its type
    for (const file of files) {
      console.log(`Processing: ${file.filename} (${file.mimeType})`);

      // Word documents
      if (isWordDocument(file.mimeType)) {
        const text = await extractTextFromWord(file.buffer);
        extractedTexts.push(`=== ${file.filename} ===\n${text}`);
        continue;
      }

      // Excel documents
      if (isExcelDocument(file.mimeType)) {
        const text = extractTextFromExcel(file.buffer);
        extractedTexts.push(`=== ${file.filename} ===\n${text}`);
        continue;
      }

      // Images - use QVQ-Max Vision
      if (isVisionSupportedType(file.mimeType)) {
        const base64Data = file.buffer.toString("base64");
        const imageUrl = `${getMimePrefix(file.mimeType)}${base64Data}`;

        const text = await callQvqApi([
          {
            role: "user",
            content: [
              { type: "text", text: `Extract all text from this document (${file.filename}):\n\n${MARK_SCHEME_PROMPT}` },
              {
                type: "image_url",
                image_url: { url: imageUrl },
              },
            ],
          },
        ]);

        extractedTexts.push(`=== ${file.filename} ===\n${text}`);
        continue;
      }

      // PDFs - use Gemini (QVQ-Max doesn't support PDFs)
      if (isPdfType(file.mimeType)) {
        const ai = getGeminiClient();
        const base64Data = file.buffer.toString("base64");

        const response = await ai.models.generateContent({
          model: GEMINI_PRO_OCR_MODEL,
          contents: [
            {
              inlineData: {
                data: base64Data,
                mimeType: "application/pdf",
              },
            },
            `Extract all text from this document (${file.filename}):\n\n${MARK_SCHEME_PROMPT}`,
          ],
        });

        extractedTexts.push(`=== ${file.filename} ===\n${response.text || ""}`);
        continue;
      }

      console.warn(`Skipping unsupported file type: ${file.mimeType}`);
    }

    // Combine all extracted texts
    return extractedTexts.join("\n\n---\n\n");
  } catch (error) {
    console.error("Multiple mark scheme extraction error:", error);
    throw new Error("Failed to extract text from mark scheme files");
  }
}

// Extract text from PDF buffer (legacy, kept for backwards compatibility)
// Uses Gemini since QVQ-Max doesn't support PDFs
export async function extractTextFromPdf(buffer: Buffer): Promise<string> {
  try {
    console.log(`Processing PDF OCR with Gemini...`);

    const ai = getGeminiClient();
    const base64Data = buffer.toString("base64");

    const response = await ai.models.generateContent({
      model: GEMINI_PRO_OCR_MODEL,
      contents: [
        {
          inlineData: {
            data: base64Data,
            mimeType: "application/pdf",
          },
        },
        MARK_SCHEME_PROMPT,
      ],
    });

    return response.text || "";
  } catch (error) {
    console.error("PDF OCR Error:", error);
    throw new Error("Failed to extract text from PDF");
  }
}
