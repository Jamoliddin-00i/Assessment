import { NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import prisma from "@/lib/prisma";

export async function GET() {
  try {
    const session = await getAuthSession();

    if (!session || session.user.role !== "TEACHER") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const teacherId = session.user.id;

    // Get total classes
    const totalClasses = await prisma.class.count({
      where: { teacherId },
    });

    // Get total students enrolled in teacher's classes
    const totalStudents = await prisma.enrollment.count({
      where: {
        class: { teacherId },
      },
    });

    // Get total assessments
    const totalAssessments = await prisma.assessment.count({
      where: {
        class: { teacherId },
      },
    });

    // Get pending submissions
    const pendingSubmissions = await prisma.submission.count({
      where: {
        status: { in: ["PENDING", "PROCESSING"] },
        assessment: {
          class: { teacherId },
        },
      },
    });

    return NextResponse.json({
      totalClasses,
      totalStudents,
      totalAssessments,
      pendingSubmissions,
    });
  } catch (error) {
    console.error("Error fetching dashboard stats:", error);
    return NextResponse.json(
      { error: "Failed to fetch dashboard stats" },
      { status: 500 }
    );
  }
}
