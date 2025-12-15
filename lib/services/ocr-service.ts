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

    // Convert to JPEG for consistency
    const normalizedBuffer = await processedImage
      .jpeg({ quality: 85 })
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
      model: "gemini-3-pro-preview",
      generationConfig: {
        // @ts-expect-error - thinkingConfig and mediaResolution are supported by Gemini 3
        thinkingConfig: { thinkingLevel: "high" },
        mediaResolution: "high",
      },
    });

    // Normalize image orientation to portrait
    const normalized = await normalizeImageOrientation(buffer, mimeType);

    // Convert buffer to base64
    const base64 = normalized.buffer.toString("base64");

    const prompt = `Extract all handwritten and printed text from this image, including mathematical content.

IMPORTANT - For mathematical expressions:
- Recognize equations, formulas, fractions, integrals, derivatives, limits, summations
- Use standard notation: ^2 for squared, sqrt() for square roots, / for fractions
- Greek letters: write as alpha, beta, theta, pi, sigma, etc.
- Integrals: ∫ or integral, derivatives: d/dx or dy/dx
- Preserve equation structure: keep equals signs aligned, show working steps
- Matrices and vectors: use brackets notation
- Trigonometric functions: sin, cos, tan, etc.
- Logarithms: ln, log, log10

Return ONLY the extracted text and math, nothing else.
If there are multiple questions or answers, label them (Q1, Q2, etc.) and preserve the structure.
If you cannot read something clearly, make your best guess.
Do not add any commentary or explanations.`;

    const result = await model.generateContent([
      prompt,
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
      confidence: 95, // Gemini doesn't provide confidence, assume high
    };
  } catch (error) {
    console.error("OCR Error:", error);
    throw new Error("Failed to extract text from image");
  }
}

// Extract text from multiple images and combine them
// Processes images in batches of 6 for better accuracy
export async function extractTextFromMultipleBuffers(
  buffers: { buffer: Buffer; mimeType: string }[]
): Promise<OcrResult> {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY is not configured");
  }

  try {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({
      model: "gemini-3-pro-preview",
      generationConfig: {
        // @ts-expect-error - thinkingConfig and mediaResolution are supported by Gemini 3
        thinkingConfig: { thinkingLevel: "high" },
        mediaResolution: "high",
      },
    });

    // Normalize all images to portrait orientation
    const normalizedBuffers = await Promise.all(
      buffers.map(async ({ buffer, mimeType }) => {
        return normalizeImageOrientation(buffer, mimeType);
      })
    );

    // Split into batches of 6 (round-robin style)
    const batches = chunkArray(normalizedBuffers, BATCH_SIZE);
    const batchResults: string[] = [];

    for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
      const batch = batches[batchIndex];
      const startPage = batchIndex * BATCH_SIZE + 1;
      const endPage = startPage + batch.length - 1;

      const prompt = `Extract all handwritten and printed text from these images, including mathematical content.
These are pages ${startPage} to ${endPage} of a document/answer sheet (batch ${batchIndex + 1} of ${batches.length}).

IMPORTANT - For mathematical expressions:
- Recognize equations, formulas, fractions, integrals, derivatives, limits, summations
- Use standard notation: ^2 for squared, sqrt() for square roots, / for fractions
- Greek letters: write as alpha, beta, theta, pi, sigma, etc.
- Integrals: ∫ or integral, derivatives: d/dx or dy/dx
- Preserve equation structure: keep equals signs aligned, show working steps
- Matrices and vectors: use brackets notation
- Trigonometric functions: sin, cos, tan, etc.
- Logarithms: ln, log, log10

Return ONLY the extracted text and math from all images combined, preserving the order.
If there are multiple questions or answers, label them (Q1, Q2, etc.) and preserve the structure.
If you cannot read something clearly, make your best guess.
Do not add any commentary or explanations.`;

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
      model: "gemini-3-pro-preview",
      generationConfig: {
        // @ts-expect-error - thinkingConfig and mediaResolution are supported by Gemini 3
        thinkingConfig: { thinkingLevel: "high" },
        mediaResolution: "high",
      },
    });

    const base64 = buffer.toString("base64");

    const prompt = `Extract all text from this PDF document, including mathematical content.
This is a mark scheme for grading student assessments (possibly A Level Mathematics or similar).

IMPORTANT - For mathematical expressions:
- Recognize equations, formulas, fractions, integrals, derivatives, limits, summations
- Use standard notation: ^2 for squared, sqrt() for square roots, / for fractions
- Greek letters: write as alpha, beta, theta, pi, sigma, etc.
- Integrals: ∫ or integral, derivatives: d/dx or dy/dx
- Preserve equation structure and working steps
- Matrices and vectors: use brackets notation

Return the complete text content preserving structure and formatting.
Include all criteria, points, model answers, and grading guidelines.
Preserve mark allocations (e.g., [2 marks], M1, A1, B1 notation).
Do not add any commentary or explanations.`;

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
