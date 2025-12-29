import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { writeFile, mkdir, readFile } from "fs/promises";
import path from "path";
import { extractHandwrittenFromSubmission } from "@/lib/services/ocr-service";
import { gradeSubmissionWithText, formatFeedbackAsMarkdown } from "@/lib/services/grading-service";

/**
 * Get MIME type from file extension
 */
function getMimeTypeFromExtension(ext: string): string {
  const mimeTypes: Record<string, string> = {
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".gif": "image/gif",
    ".webp": "image/webp",
  };
  return mimeTypes[ext.toLowerCase()] || "image/jpeg";
}

export async function POST(request: NextRequest) {
  try {
    const session = await getAuthSession();

    // Only teachers can submit work for students
    if (!session || session.user.role !== "TEACHER") {
      return NextResponse.json({ error: "Unauthorized - Only teachers can submit work" }, { status: 401 });
    }

    const formData = await request.formData();
    const files = formData.getAll("files") as File[];
    const assessmentId = formData.get("assessmentId") as string;
    const studentId = formData.get("studentId") as string;
    const reuseImageUrlsStr = formData.get("reuseImageUrls") as string | null;

    // Parse reuse URLs if provided
    let reuseImageUrls: string[] = [];
    if (reuseImageUrlsStr) {
      try {
        reuseImageUrls = JSON.parse(reuseImageUrlsStr);
      } catch {
        return NextResponse.json({ error: "Invalid reuseImageUrls format" }, { status: 400 });
      }
    }

    // Must have either files or reuse URLs
    const hasFiles = files && files.length > 0;
    const hasReuseUrls = reuseImageUrls.length > 0;

    if (!hasFiles && !hasReuseUrls) {
      return NextResponse.json({ error: "No files uploaded and no previous images to reuse" }, { status: 400 });
    }

    if (!assessmentId) {
      return NextResponse.json(
        { error: "Assessment ID required" },
        { status: 400 }
      );
    }

    if (!studentId) {
      return NextResponse.json(
        { error: "Student ID required" },
        { status: 400 }
      );
    }

    // Verify assessment exists and teacher owns the class
    const assessment = await prisma.assessment.findUnique({
      where: { id: assessmentId },
      include: {
        class: {
          include: {
            enrollments: {
              where: { studentId: studentId },
            },
          },
        },
      },
    });

    if (!assessment) {
      return NextResponse.json(
        { error: "Assessment not found" },
        { status: 404 }
      );
    }

    // Verify teacher owns the class
    if (assessment.class.teacherId !== session.user.id) {
      return NextResponse.json(
        { error: "You don't have permission to submit for this assessment" },
        { status: 401 }
      );
    }

    // Verify student is enrolled in the class
    if (assessment.class.enrollments.length === 0) {
      return NextResponse.json(
        { error: "Student is not enrolled in this class" },
        { status: 400 }
      );
    }

    if (assessment.status !== "ACTIVE") {
      return NextResponse.json(
        { error: "This assessment is not accepting submissions" },
        { status: 400 }
      );
    }

    // Check if already submitted - if so, delete the old submission
    const existingSubmission = await prisma.submission.findUnique({
      where: {
        studentId_assessmentId: {
          studentId: studentId,
          assessmentId,
        },
      },
    });

    if (existingSubmission) {
      // Delete existing submission to allow re-submission
      await prisma.submission.delete({
        where: { id: existingSubmission.id },
      });
    }

    const uploadsDir = path.join(process.cwd(), "public", "uploads");
    await mkdir(uploadsDir, { recursive: true });

    let imageUrls: string[] = [];
    const buffers: { buffer: Buffer; mimeType: string }[] = [];

    if (hasReuseUrls) {
      // Reuse existing image URLs - load buffers from disk
      console.log(`Reusing ${reuseImageUrls.length} existing images for resubmission`);
      imageUrls = reuseImageUrls;

      for (const url of reuseImageUrls) {
        try {
          const filePath = path.join(process.cwd(), "public", url);
          const buffer = await readFile(filePath);
          const ext = path.extname(url).toLowerCase();
          const mimeType = getMimeTypeFromExtension(ext);
          buffers.push({ buffer, mimeType });
        } catch (error) {
          console.error(`Failed to read file ${url}:`, error);
          return NextResponse.json(
            { error: `Failed to load previous image: ${url}` },
            { status: 400 }
          );
        }
      }
    } else {
      // Save new files
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const bytes = await file.arrayBuffer();
        const buffer = Buffer.from(bytes);

        // Generate unique filename
        const ext = path.extname(file.name);
        const filename = `${studentId}-${assessmentId}-${Date.now()}-${i}${ext}`;
        const filepath = path.join(uploadsDir, filename);

        await writeFile(filepath, buffer);
        imageUrls.push(`/uploads/${filename}`);
        buffers.push({ buffer, mimeType: file.type });
      }
    }

    // Create submission with PROCESSING status
    const submission = await prisma.submission.create({
      data: {
        imageUrls: JSON.stringify(imageUrls),
        status: "PROCESSING",
        studentId: studentId,
        assessmentId,
        maxScore: assessment.totalMarks,
      },
    });

    // Get mark scheme text (OCR'd when assessment was created)
    const markSchemeText = assessment.markScheme || "";

    if (!markSchemeText) {
      console.warn(`Assessment ${assessmentId} has no mark scheme text`);
    }

    // Process grading asynchronously
    processSubmission(
      submission.id,
      buffers,
      imageUrls,
      markSchemeText,
      assessment.totalMarks
    );

    return NextResponse.json(
      {
        message: "Submission uploaded successfully",
        submission: {
          id: submission.id,
          status: submission.status,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error uploading submission:", error);
    return NextResponse.json(
      { error: "Failed to upload submission" },
      { status: 500 }
    );
  }
}

/**
 * Process submission with text comparison pipeline:
 *
 * 1. Gemini 2.0 Flash Lite: Fast page number detection + sorting
 * 2. QVQ-Max: OCR to extract ONLY handwritten content from student answers
 * 3. Gemini 2.5 Flash: Compare student's extracted text against mark scheme OCR text
 */
async function processSubmission(
  submissionId: string,
  buffers: { buffer: Buffer; mimeType: string }[],
  imageUrls: string[],
  markSchemeText: string,
  totalMarks: number
) {
  try {
    // ═══════════════════════════════════════════════════════════════════════════
    // STEP 1: Sort images & extract ONLY handwritten content using QVQ-Max
    // ═══════════════════════════════════════════════════════════════════════════
    console.log(`Processing submission ${submissionId}: Sorting & extracting handwritten content...`);
    const ocrResult = await extractHandwrittenFromSubmission(buffers);
    console.log(`Images sorted by page: ${ocrResult.sortedOriginalIndices.join(", ")}`);
    console.log(`Extracted ${ocrResult.text.length} characters of handwritten content`);

    // Reorder image URLs based on detected page order
    const sortedImageUrls = ocrResult.sortedOriginalIndices.map(i => imageUrls[i]);

    // Update submission with sorted image URLs and extracted text
    await prisma.submission.update({
      where: { id: submissionId },
      data: {
        imageUrls: JSON.stringify(sortedImageUrls),
        extractedText: ocrResult.text,
      },
    });

    // ═══════════════════════════════════════════════════════════════════════════
    // STEP 2: Grade using Gemini 2.5 Flash with TEXT COMPARISON
    //         Compares student's handwritten OCR text vs mark scheme OCR text
    // ═══════════════════════════════════════════════════════════════════════════
    console.log(`Grading submission ${submissionId} with Gemini 2.5 Flash (text comparison)...`);
    const gradingResult = await gradeSubmissionWithText(
      ocrResult.text,
      markSchemeText,
      totalMarks
    );

    // Format feedback as markdown
    const formattedFeedback = formatFeedbackAsMarkdown(gradingResult);

    // Update submission with results (use maxScore from grading)
    await prisma.submission.update({
      where: { id: submissionId },
      data: {
        score: gradingResult.score,
        maxScore: gradingResult.maxScore,
        feedback: formattedFeedback,
        status: "GRADED",
        gradedAt: new Date(),
      },
    });

    console.log(`Submission ${submissionId} graded: ${gradingResult.score}/${gradingResult.maxScore}`);
  } catch (error) {
    console.error(`Error processing submission ${submissionId}:`, error);

    // Create user-friendly error message
    let userMessage = "An error occurred while processing your submission.";
    const errorMsg = error instanceof Error ? error.message : "";

    if (errorMsg.includes('fetch failed') ||
        errorMsg.includes('ECONNRESET') ||
        errorMsg.includes('ENOTFOUND') ||
        errorMsg.includes('timeout')) {
      userMessage = "Connection error: Unable to reach the grading service. Please check your internet connection and try again.";
    } else if (errorMsg.includes('API key')) {
      userMessage = "Configuration error: The grading service is not properly configured. Please contact your administrator.";
    } else if (errorMsg.includes('parse') || errorMsg.includes('JSON')) {
      userMessage = "Processing error: The grading service returned an unexpected response. Please try again.";
    }

    // Update status to ERROR
    await prisma.submission.update({
      where: { id: submissionId },
      data: {
        status: "ERROR",
        feedback: userMessage,
      },
    });
  }
}
