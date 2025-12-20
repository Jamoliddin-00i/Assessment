import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import {
  extractTextFromMultipleMarkSchemeFiles,
  extractTextFromMarkSchemeFile,
  isSupportedMarkSchemeType,
  getExtensionFromMimeType,
} from "@/lib/services/ocr-service";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ classId: string }> }
) {
  try {
    const session = await getAuthSession();
    const { classId } = await params;

    if (!session || session.user.role !== "TEACHER") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Verify the teacher owns this class
    const classData = await prisma.class.findUnique({
      where: { id: classId },
    });

    if (!classData) {
      return NextResponse.json({ error: "Class not found" }, { status: 404 });
    }

    if (classData.teacherId !== session.user.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await request.formData();
    const title = formData.get("title") as string;
    const totalMarks = parseInt(formData.get("totalMarks") as string, 10);

    // Get all mark scheme files (supports multiple files)
    const markSchemeFiles = formData.getAll("markSchemeFiles") as File[];

    if (!title || title.length < 2) {
      return NextResponse.json(
        { error: "Title must be at least 2 characters" },
        { status: 400 }
      );
    }

    if (!totalMarks || totalMarks < 1) {
      return NextResponse.json(
        { error: "Total marks must be at least 1" },
        { status: 400 }
      );
    }

    if (!markSchemeFiles || markSchemeFiles.length === 0) {
      return NextResponse.json(
        { error: "At least one mark scheme file is required" },
        { status: 400 }
      );
    }

    // Validate all files
    for (const file of markSchemeFiles) {
      if (!isSupportedMarkSchemeType(file.type)) {
        return NextResponse.json(
          { error: `Unsupported file type: ${file.type}. Supported: PDF, Word, Excel, and images.` },
          { status: 400 }
        );
      }
    }

    // Save all files
    const uploadsDir = path.join(process.cwd(), "public", "uploads", "markschemes");
    await mkdir(uploadsDir, { recursive: true });

    const savedFileUrls: string[] = [];
    const fileBuffers: { buffer: Buffer; mimeType: string; filename: string }[] = [];

    for (let i = 0; i < markSchemeFiles.length; i++) {
      const file = markSchemeFiles[i];
      const bytes = await file.arrayBuffer();
      const buffer = Buffer.from(bytes);

      // Get the appropriate extension based on MIME type
      const extension = getExtensionFromMimeType(file.type) || path.extname(file.name) || ".bin";
      const filename = `${classId}-${Date.now()}-${i}${extension}`;
      const filepath = path.join(uploadsDir, filename);
      await writeFile(filepath, buffer);

      const fileUrl = `/uploads/markschemes/${filename}`;
      savedFileUrls.push(fileUrl);
      fileBuffers.push({ buffer, mimeType: file.type, filename: file.name });
    }

    // Extract text from all mark scheme files
    console.log(`Extracting text from ${markSchemeFiles.length} mark scheme file(s)...`);

    let markSchemeText: string;
    if (fileBuffers.length === 1) {
      // Single file - use single file extraction
      markSchemeText = await extractTextFromMarkSchemeFile(
        fileBuffers[0].buffer,
        fileBuffers[0].mimeType
      );
    } else {
      // Multiple files - use combined extraction
      markSchemeText = await extractTextFromMultipleMarkSchemeFiles(fileBuffers);
    }

    console.log("Mark scheme text extracted successfully");

    if (!markSchemeText || markSchemeText.length < 10) {
      return NextResponse.json(
        { error: "Could not extract text from files. Please ensure the files contain readable content." },
        { status: 400 }
      );
    }

    const assessment = await prisma.assessment.create({
      data: {
        title,
        markScheme: markSchemeText,
        markSchemePdfUrl: savedFileUrls[0], // First file URL for backwards compatibility
        markSchemeFileUrls: JSON.stringify(savedFileUrls), // All file URLs
        totalMarks,
        classId,
      },
    });

    return NextResponse.json(
      { message: "Assessment created successfully", assessment },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error creating assessment:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: `Failed to create assessment: ${errorMessage}` },
      { status: 500 }
    );
  }
}
