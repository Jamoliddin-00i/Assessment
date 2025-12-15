import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import prisma from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    const session = await getAuthSession();

    if (!session || session.user.role !== "STUDENT") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const limit = parseInt(searchParams.get("limit") || "5");

    // Get enrolled class IDs
    const enrollments = await prisma.enrollment.findMany({
      where: { studentId: session.user.id },
      select: { classId: true },
    });

    const classIds = enrollments.map((e) => e.classId);

    // Get recent assessments from enrolled classes
    const assessments = await prisma.assessment.findMany({
      where: {
        classId: { in: classIds },
        status: "ACTIVE",
      },
      include: {
        class: {
          select: { name: true },
        },
        submissions: {
          where: { studentId: session.user.id },
          select: {
            id: true,
            score: true,
            status: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: limit,
    });

    return NextResponse.json({ assessments });
  } catch (error) {
    console.error("Error fetching recent assessments:", error);
    return NextResponse.json(
      { error: "Failed to fetch assessments" },
      { status: 500 }
    );
  }
}
