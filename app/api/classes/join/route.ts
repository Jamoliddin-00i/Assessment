import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { z } from "zod";

const joinClassSchema = z.object({
  code: z.string().length(6, "Class code must be 6 characters"),
});

export async function POST(request: NextRequest) {
  try {
    const session = await getAuthSession();

    if (!session || session.user.role !== "STUDENT") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const validatedData = joinClassSchema.parse(body);

    // Find the class by code
    const classToJoin = await prisma.class.findUnique({
      where: { code: validatedData.code },
      include: {
        teacher: {
          select: { name: true },
        },
      },
    });

    if (!classToJoin) {
      return NextResponse.json(
        { error: "Class not found. Please check the code and try again." },
        { status: 404 }
      );
    }

    // Check if student is already enrolled
    const existingEnrollment = await prisma.enrollment.findUnique({
      where: {
        studentId_classId: {
          studentId: session.user.id,
          classId: classToJoin.id,
        },
      },
    });

    if (existingEnrollment) {
      return NextResponse.json(
        { error: "You are already enrolled in this class" },
        { status: 400 }
      );
    }

    // Create enrollment
    await prisma.enrollment.create({
      data: {
        studentId: session.user.id,
        classId: classToJoin.id,
      },
    });

    return NextResponse.json({
      message: "Joined class successfully",
      class: {
        id: classToJoin.id,
        name: classToJoin.name,
        teacher: classToJoin.teacher.name,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.errors[0].message },
        { status: 400 }
      );
    }

    console.error("Error joining class:", error);
    return NextResponse.json(
      { error: "Failed to join class" },
      { status: 500 }
    );
  }
}
