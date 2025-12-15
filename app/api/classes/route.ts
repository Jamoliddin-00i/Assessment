import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { generateClassCode } from "@/lib/utils";
import { z } from "zod";

const createClassSchema = z.object({
  name: z.string().min(2, "Class name must be at least 2 characters"),
  description: z.string().optional(),
  subject: z.string().optional(),
});

export async function GET(request: NextRequest) {
  try {
    const session = await getAuthSession();

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const limit = parseInt(searchParams.get("limit") || "50");

    if (session.user.role === "TEACHER") {
      const classes = await prisma.class.findMany({
        where: { teacherId: session.user.id },
        include: {
          _count: {
            select: {
              enrollments: true,
              assessments: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
        take: limit,
      });

      return NextResponse.json({ classes });
    }

    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  } catch (error) {
    console.error("Error fetching classes:", error);
    return NextResponse.json(
      { error: "Failed to fetch classes" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getAuthSession();

    if (!session || session.user.role !== "TEACHER") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const validatedData = createClassSchema.parse(body);

    // Generate unique class code
    let code = generateClassCode();
    let existingClass = await prisma.class.findUnique({ where: { code } });

    while (existingClass) {
      code = generateClassCode();
      existingClass = await prisma.class.findUnique({ where: { code } });
    }

    const newClass = await prisma.class.create({
      data: {
        name: validatedData.name,
        description: validatedData.description,
        subject: validatedData.subject,
        code,
        teacherId: session.user.id,
      },
    });

    return NextResponse.json(
      { message: "Class created successfully", class: newClass },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.errors[0].message },
        { status: 400 }
      );
    }

    console.error("Error creating class:", error);
    return NextResponse.json(
      { error: "Failed to create class" },
      { status: 500 }
    );
  }
}
