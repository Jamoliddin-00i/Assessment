import { NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import prisma from "@/lib/prisma";

export async function GET() {
  try {
    const session = await getAuthSession();

    if (!session || session.user.role !== "STUDENT") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const studentId = session.user.id;

    // Get total enrolled classes
    const totalClasses = await prisma.enrollment.count({
      where: { studentId },
    });

    // Get completed assessments (graded submissions)
    const completedAssessments = await prisma.submission.count({
      where: {
        studentId,
        status: "GRADED",
      },
    });

    // Get average score
    const submissions = await prisma.submission.findMany({
      where: {
        studentId,
        status: "GRADED",
        score: { not: null },
        maxScore: { not: null },
      },
      select: {
        score: true,
        maxScore: true,
      },
    });

    let averageScore = 0;
    if (submissions.length > 0) {
      const totalPercentage = submissions.reduce((acc, sub) => {
        return acc + ((sub.score || 0) / (sub.maxScore || 1)) * 100;
      }, 0);
      averageScore = totalPercentage / submissions.length;
    }

    // Get pending assessments (assessments without submissions)
    const enrolledClassIds = await prisma.enrollment.findMany({
      where: { studentId },
      select: { classId: true },
    });

    const classIds = enrolledClassIds.map((e) => e.classId);

    const totalActiveAssessments = await prisma.assessment.count({
      where: {
        classId: { in: classIds },
        status: "ACTIVE",
      },
    });

    const submittedAssessments = await prisma.submission.count({
      where: {
        studentId,
        assessment: {
          classId: { in: classIds },
        },
      },
    });

    const pendingAssessments = totalActiveAssessments - submittedAssessments;

    return NextResponse.json({
      totalClasses,
      completedAssessments,
      averageScore,
      pendingAssessments: Math.max(0, pendingAssessments),
    });
  } catch (error) {
    console.error("Error fetching student dashboard stats:", error);
    return NextResponse.json(
      { error: "Failed to fetch dashboard stats" },
      { status: 500 }
    );
  }
}
