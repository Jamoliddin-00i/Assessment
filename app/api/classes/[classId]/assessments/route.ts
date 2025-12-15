import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { extractTextFromPdf } from "@/lib/services/ocr-service";

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
    const markSchemePdf = formData.get("markSchemePdf") as File;

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

    if (!markSchemePdf) {
      return NextResponse.json(
        { error: "Mark scheme PDF is required" },
        { status: 400 }
      );
    }

    // Save the PDF file
    const uploadsDir = path.join(process.cwd(), "public", "uploads", "markschemes");
    await mkdir(uploadsDir, { recursive: true });

    const bytes = await markSchemePdf.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const filename = `${classId}-${Date.now()}.pdf`;
    const filepath = path.join(uploadsDir, filename);
    await writeFile(filepath, buffer);

    const markSchemePdfUrl = `/uploads/markschemes/${filename}`;

    // Extract text from PDF using Gemini
    console.log("Extracting text from mark scheme PDF...");
    const markSchemeText = await extractTextFromPdf(buffer);
    console.log("Mark scheme text extracted successfully");

    if (!markSchemeText || markSchemeText.length < 10) {
      return NextResponse.json(
        { error: "Could not extract text from PDF. Please ensure the PDF contains readable text." },
        { status: 400 }
      );
    }

    const assessment = await prisma.assessment.create({
      data: {
        title,
        markScheme: markSchemeText,
        markSchemePdfUrl,
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
    return NextResponse.json(
      { error: "Failed to create assessment" },
      { status: 500 }
    );
  }
}
