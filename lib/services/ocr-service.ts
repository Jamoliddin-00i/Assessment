import { GoogleGenerativeAI } from "@google/generative-ai";

// Dynamic import for sharp to handle potential issues
let sharpModule: typeof import("sharp") | null = null;

async function getSharp() {
  if (sharpModule === null) {
    try {
      sharpModule = (await import("sharp")).default;
    } catch {
      console.warn("Sharp module not available, image normalization disabled");
      sharpModule = undefined as unknown as typeof import("sharp");
    }
  }
  return sharpModule;
}

export interface OcrResult {
  text: string;
  confidence: number;
}

const BATCH_SIZE = 6;

// Use a stable model that works well with images
const GEMINI_MODEL = "gemini-2.0-flash-exp";

/**
 * Normalize image orientation to portrait mode
 * - Auto-rotates based on EXIF data
 * - Rotates landscape images to portrait
 * - Falls back to original if processing fails
 */
async function normalizeImageOrientation(
  buffer: Buffer,
  mimeType: string
): Promise<{ buffer: Buffer; mimeType: string }> {
  try {
    // Skip non-image files
    if (!mimeType.startsWith("image/")) {
      return { buffer, mimeType };
    }

    const sharp = await getSharp();
    if (!sharp) {
      return { buffer, mimeType };
    }

    // Create sharp instance with auto-rotation
    const image = sharp(buffer, { failOnError: false }).rotate();

    // Get image metadata to check dimensions
    const metadata = await image.metadata();

    let processedImage = image;

    if (metadata.width && metadata.height) {
      // If landscape (width > height), rotate 90 degrees clockwise to make portrait
      if (metadata.width > metadata.height) {
        processedImage = image.rotate(90);
      }
    }

    // Convert to JPEG for consistency with higher quality for better OCR
    const normalizedBuffer = await processedImage
      .jpeg({ quality: 95 })
      .toBuffer();

    return {
      buffer: normalizedBuffer,
      mimeType: "image/jpeg",
    };
  } catch (error) {
    console.warn("Image normalization failed, using original:", error);
    return { buffer, mimeType };
  }
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

// Comprehensive OCR prompt for handwritten content including tables and diagrams
const OCR_PROMPT_SINGLE = `You are an expert OCR system specialized in reading handwritten academic content.

Extract ALL text from this image with extreme care for accuracy. This includes:

## TEXT CONTENT:
- All handwritten and printed text
- Question numbers and labels (Q1, Q2, a), b), i), ii), etc.)
- Any headers, titles, or annotations

## MATHEMATICAL EXPRESSIONS:
- Equations, formulas, fractions: use notation like x^2, sqrt(x), a/b
- Greek letters: alpha, beta, theta, pi, sigma, delta, lambda, etc.
- Calculus: integrals (∫), derivatives (d/dx, dy/dx), limits (lim)
- Summations: Σ or sum from i=1 to n
- Matrices: use bracket notation [[a,b],[c,d]]
- Vectors: use angle brackets or bold notation
- Set notation: ∈, ∪, ∩, ⊆
- Logic: ∀, ∃, →, ↔, ¬, ∧, ∨

## TABLES AND STRUCTURED DATA:
- Preserve table structure using markdown table format:
  | Header1 | Header2 | Header3 |
  |---------|---------|---------|
  | Cell1   | Cell2   | Cell3   |
- For handwritten tables, carefully read each cell value
- Include row and column headers if present
- Preserve alignment and spacing relationships

## DIAGRAMS AND DATA STRUCTURES:
- Linked lists: represent as Node1 -> Node2 -> Node3 -> NULL
- Trees: use indentation or notation like Root(Left, Right)
- Graphs: list vertices and edges, e.g., V={A,B,C}, E={(A,B),(B,C)}
- Flowcharts: describe the flow with arrows (->)
- State diagrams: State1 --event--> State2
- Arrays: [val1, val2, val3, ...]
- Pointers/references: use arrow notation (ptr -> value)

## COMPUTER SCIENCE CONTENT:
- Code snippets: preserve indentation and syntax
- Pseudocode: maintain structure and keywords
- Algorithm steps: number them clearly
- Memory diagrams: show addresses and values
- Binary/hex numbers: prefix with 0b or 0x

## INSTRUCTIONS:
1. Read every piece of text, even if partially obscured
2. For unclear handwriting, make your best educated guess
3. Preserve the original structure and order
4. Use markdown formatting for clarity
5. Do NOT add explanations or commentary
6. Do NOT skip any content - extract everything visible

OUTPUT: Return ONLY the extracted content, preserving its structure.`;

const OCR_PROMPT_BATCH = (startPage: number, endPage: number, batchNum: number, totalBatches: number) =>
`You are an expert OCR system specialized in reading handwritten academic content.

These are pages ${startPage} to ${endPage} of a student's answer sheet (batch ${batchNum} of ${totalBatches}).

Extract ALL text from these images with extreme care for accuracy. This includes:

## TEXT CONTENT:
- All handwritten and printed text
- Question numbers and labels (Q1, Q2, a), b), i), ii), etc.)
- Any headers, titles, or annotations
- Page numbers if visible

## MATHEMATICAL EXPRESSIONS:
- Equations, formulas, fractions: use notation like x^2, sqrt(x), a/b
- Greek letters: alpha, beta, theta, pi, sigma, delta, lambda, etc.
- Calculus: integrals (∫), derivatives (d/dx, dy/dx), limits (lim)
- Summations: Σ or sum from i=1 to n
- Matrices: use bracket notation [[a,b],[c,d]]
- Vectors: use angle brackets or bold notation

## TABLES AND STRUCTURED DATA:
- Preserve table structure using markdown table format:
  | Header1 | Header2 | Header3 |
  |---------|---------|---------|
  | Cell1   | Cell2   | Cell3   |
- For handwritten tables, carefully read each cell value
- Include row and column headers if present
- Preserve alignment and spacing relationships

## DIAGRAMS AND DATA STRUCTURES:
- Linked lists: represent as Node1 -> Node2 -> Node3 -> NULL
- Trees: use indentation or notation like Root(Left, Right)
- Graphs: list vertices and edges, e.g., V={A,B,C}, E={(A,B),(B,C)}
- Arrays: [val1, val2, val3, ...]
- Pointers/references: use arrow notation (ptr -> value)
- Memory diagrams: show addresses and values

## COMPUTER SCIENCE CONTENT:
- Code snippets: preserve indentation and syntax
- Pseudocode: maintain structure and keywords
- Algorithm steps: number them clearly
- Binary/hex numbers: prefix with 0b or 0x

## INSTRUCTIONS:
1. Process images in order (page ${startPage} first, then ${startPage + 1}, etc.)
2. Read every piece of text, even if partially obscured
3. For unclear handwriting, make your best educated guess
4. Preserve the original structure and order
5. Separate content from different pages with "--- Page X ---" markers
6. Do NOT add explanations or commentary
7. Do NOT skip any content - extract everything visible

OUTPUT: Return ONLY the extracted content from all images, preserving structure.`;

// Use Gemini Vision for OCR
export async function extractTextFromBuffer(
  buffer: Buffer,
  mimeType: string
): Promise<OcrResult> {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY is not configured");
  }

  try {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({
      model: GEMINI_MODEL,
    });

    // Normalize image orientation to portrait
    const normalized = await normalizeImageOrientation(buffer, mimeType);

    // Convert buffer to base64
    const base64 = normalized.buffer.toString("base64");

    const result = await model.generateContent([
      OCR_PROMPT_SINGLE,
      {
        inlineData: {
          mimeType: normalized.mimeType,
          data: base64,
        },
      },
    ]);

    const response = await result.response;
    const text = response.text().trim();

    return {
      text: text,
      confidence: 95,
    };
  } catch (error) {
    console.error("OCR Error:", error);
    throw new Error("Failed to extract text from image");
  }
}

// Extract text from multiple images and combine them
// Processes images in batches of 6 for better accuracy
// IMPORTANT: First normalizes ALL images to portrait, THEN processes OCR in order
export async function extractTextFromMultipleBuffers(
  buffers: { buffer: Buffer; mimeType: string }[]
): Promise<OcrResult> {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY is not configured");
  }

  try {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({
      model: GEMINI_MODEL,
    });

    // STEP 1: Normalize ALL images to portrait orientation FIRST (sequentially to preserve order)
    // This ensures every image is in portrait mode before any OCR processing begins
    const normalizedBuffers: { buffer: Buffer; mimeType: string; pageIndex: number }[] = [];

    console.log(`Normalizing ${buffers.length} images to portrait mode...`);

    for (let i = 0; i < buffers.length; i++) {
      const { buffer, mimeType } = buffers[i];
      const normalized = await normalizeImageOrientation(buffer, mimeType);
      normalizedBuffers.push({
        buffer: normalized.buffer,
        mimeType: normalized.mimeType,
        pageIndex: i, // Explicitly track original order
      });
      console.log(`  Image ${i + 1}/${buffers.length} normalized to portrait`);
    }

    // STEP 2: Sort by pageIndex to ensure correct order (should already be in order, but explicit is safer)
    normalizedBuffers.sort((a, b) => a.pageIndex - b.pageIndex);

    console.log(`All images normalized. Starting OCR processing...`);

    // STEP 3: Split into batches of 6 for OCR processing
    const batches = chunkArray(normalizedBuffers, BATCH_SIZE);
    const batchResults: string[] = [];

    for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
      const batch = batches[batchIndex];
      const startPage = batch[0].pageIndex + 1; // Use actual page index
      const endPage = batch[batch.length - 1].pageIndex + 1;

      console.log(`Processing OCR batch ${batchIndex + 1}/${batches.length} (pages ${startPage}-${endPage})...`);

      const prompt = OCR_PROMPT_BATCH(startPage, endPage, batchIndex + 1, batches.length);

      const imageParts = batch.map(({ buffer, mimeType }) => ({
        inlineData: {
          mimeType: mimeType,
          data: buffer.toString("base64"),
        },
      }));

      const result = await model.generateContent([prompt, ...imageParts]);
      const response = await result.response;
      batchResults.push(response.text().trim());
    }

    // Combine all batch results
    const combinedText = batchResults.join("\n\n---\n\n");

    return {
      text: combinedText,
      confidence: 95,
    };
  } catch (error) {
    console.error("OCR Error:", error);
    throw new Error("Failed to extract text from images");
  }
}

// Extract text from PDF buffer
export async function extractTextFromPdf(buffer: Buffer): Promise<string> {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY is not configured");
  }

  try {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({
      model: GEMINI_MODEL,
    });

    const base64 = buffer.toString("base64");

    const prompt = `Extract all text from this PDF document, which is a mark scheme for grading student assessments.

## CONTENT TO EXTRACT:
- All questions and sub-questions
- Model answers and acceptable alternatives
- Mark allocations (e.g., [2 marks], M1, A1, B1 notation)
- Marking guidelines and criteria
- Any tables, diagrams descriptions, or structured content

## MATHEMATICAL EXPRESSIONS:
- Equations and formulas: use notation like x^2, sqrt(x), a/b
- Greek letters: alpha, beta, theta, pi, sigma, etc.
- Calculus notation: integrals (∫), derivatives (d/dx), limits
- Preserve equation structure and working steps

## TABLES:
- Use markdown table format to preserve structure
- Include all mark scheme tables

## INSTRUCTIONS:
1. Extract ALL content from every page
2. Preserve the structure and formatting
3. Keep mark allocations clearly associated with their criteria
4. Do NOT add commentary or explanations
5. Do NOT skip any content

OUTPUT: Return the complete mark scheme content with structure preserved.`;

    const result = await model.generateContent([
      prompt,
      {
        inlineData: {
          mimeType: "application/pdf",
          data: base64,
        },
      },
    ]);

    const response = await result.response;
    return response.text().trim();
  } catch (error) {
    console.error("PDF OCR Error:", error);
    throw new Error("Failed to extract text from PDF");
  }
}
