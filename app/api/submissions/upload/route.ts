import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { extractTextFromMultipleBuffers } from "@/lib/services/ocr-service";
import { gradeSubmission, formatFeedbackAsMarkdown } from "@/lib/services/grading-service";

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

    if (!files || files.length === 0) {
      return NextResponse.json({ error: "No files uploaded" }, { status: 400 });
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

    // Save files
    const uploadsDir = path.join(process.cwd(), "public", "uploads");
    await mkdir(uploadsDir, { recursive: true });

    const imageUrls: string[] = [];
    const buffers: { buffer: Buffer; mimeType: string }[] = [];

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

    // Process OCR and grading asynchronously
    processSubmission(submission.id, buffers, assessment.markScheme, assessment.totalMarks);

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

async function processSubmission(
  submissionId: string,
  buffers: { buffer: Buffer; mimeType: string }[],
  markScheme: string,
  totalMarks: number
) {
  try {
    // Extract text using OCR (Gemini Vision)
    console.log(`Processing OCR for submission ${submissionId}...`);
    const ocrResult = await extractTextFromMultipleBuffers(buffers);
    console.log(`OCR completed for submission ${submissionId}`);

    // Update with extracted text
    await prisma.submission.update({
      where: { id: submissionId },
      data: {
        extractedText: ocrResult.text,
      },
    });

    // Grade the submission
    console.log(`Grading submission ${submissionId}...`);
    const gradingResult = await gradeSubmission(
      ocrResult.text,
      markScheme,
      totalMarks
    );

    // Format feedback as markdown
    const formattedFeedback = formatFeedbackAsMarkdown(gradingResult);

    // Update submission with results
    await prisma.submission.update({
      where: { id: submissionId },
      data: {
        score: gradingResult.score,
        feedback: formattedFeedback,
        status: "GRADED",
        gradedAt: new Date(),
      },
    });

    console.log(`Submission ${submissionId} graded: ${gradingResult.score}/${totalMarks}`);
  } catch (error) {
    console.error(`Error processing submission ${submissionId}:`, error);

    // Update status to ERROR
    await prisma.submission.update({
      where: { id: submissionId },
      data: {
        status: "ERROR",
        feedback: `Error processing submission: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
      },
    });
  }
}
