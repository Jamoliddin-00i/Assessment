import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { unlink } from "fs/promises";
import path from "path";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ submissionId: string }> }
) {
  try {
    const session = await getAuthSession();
    const { submissionId } = await params;

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const submission = await prisma.submission.findUnique({
      where: { id: submissionId },
      include: {
        student: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        assessment: {
          include: {
            class: {
              select: {
                name: true,
                teacherId: true,
              },
            },
          },
        },
      },
    });

    if (!submission) {
      return NextResponse.json(
        { error: "Submission not found" },
        { status: 404 }
      );
    }

    // Check access - only teacher of the class or the student who submitted can view
    const isTeacher =
      session.user.role === "TEACHER" &&
      submission.assessment.class.teacherId === session.user.id;
    const isOwner = submission.studentId === session.user.id;

    if (!isTeacher && !isOwner) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    return NextResponse.json({ submission });
  } catch (error) {
    console.error("Error fetching submission:", error);
    return NextResponse.json(
      { error: "Failed to fetch submission" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ submissionId: string }> }
) {
  try {
    const session = await getAuthSession();
    const { submissionId } = await params;

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const submission = await prisma.submission.findUnique({
      where: { id: submissionId },
      include: {
        assessment: {
          include: {
            class: {
              select: {
                teacherId: true,
              },
            },
          },
        },
      },
    });

    if (!submission) {
      return NextResponse.json(
        { error: "Submission not found" },
        { status: 404 }
      );
    }

    // Check access - only teacher of the class or the student who submitted can delete
    const isTeacher =
      session.user.role === "TEACHER" &&
      submission.assessment.class.teacherId === session.user.id;
    const isOwner = submission.studentId === session.user.id;

    if (!isTeacher && !isOwner) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Students can only delete if assessment is still active
    if (isOwner && !isTeacher && submission.assessment.status !== "ACTIVE") {
      return NextResponse.json(
        { error: "Cannot delete submission - assessment is no longer active" },
        { status: 400 }
      );
    }

    // Try to delete the uploaded files
    if (submission.imageUrls) {
      try {
        const imageUrls: string[] = JSON.parse(submission.imageUrls);
        for (const imageUrl of imageUrls) {
          try {
            const filePath = path.join(process.cwd(), "public", imageUrl);
            await unlink(filePath);
          } catch (fileError) {
            // File might not exist, continue anyway
            console.warn("Could not delete file:", imageUrl, fileError);
          }
        }
      } catch (parseError) {
        console.warn("Could not parse imageUrls:", parseError);
      }
    }

    // Delete the submission
    await prisma.submission.delete({
      where: { id: submissionId },
    });

    return NextResponse.json({ message: "Submission deleted successfully" });
  } catch (error) {
    console.error("Error deleting submission:", error);
    return NextResponse.json(
      { error: "Failed to delete submission" },
      { status: 500 }
    );
  }
}

// PATCH - Teacher adjusts score
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ submissionId: string }> }
) {
  try {
    const session = await getAuthSession();
    const { submissionId } = await params;

    if (!session || session.user.role !== "TEACHER") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { score, reason } = body;

    if (score === undefined || score === null) {
      return NextResponse.json(
        { error: "Score is required" },
        { status: 400 }
      );
    }

    if (!reason || reason.trim() === "") {
      return NextResponse.json(
        { error: "Reason for adjustment is required" },
        { status: 400 }
      );
    }

    const submission = await prisma.submission.findUnique({
      where: { id: submissionId },
      include: {
        assessment: {
          include: {
            class: {
              select: {
                teacherId: true,
              },
            },
          },
        },
      },
    });

    if (!submission) {
      return NextResponse.json(
        { error: "Submission not found" },
        { status: 404 }
      );
    }

    // Only the teacher of this class can adjust scores
    if (submission.assessment.class.teacherId !== session.user.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Validate score is within range
    if (score < 0 || score > submission.maxScore!) {
      return NextResponse.json(
        { error: `Score must be between 0 and ${submission.maxScore}` },
        { status: 400 }
      );
    }

    // Store original score if this is the first adjustment
    const originalScore = submission.originalScore ?? submission.score;

    // Update the submission with adjusted score
    const updatedSubmission = await prisma.submission.update({
      where: { id: submissionId },
      data: {
        score: score,
        originalScore: originalScore,
        adjustedBy: session.user.id,
        adjustmentReason: reason.trim(),
        adjustedAt: new Date(),
      },
      include: {
        student: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        assessment: {
          include: {
            class: {
              select: {
                name: true,
                teacherId: true,
              },
            },
          },
        },
      },
    });

    return NextResponse.json({ submission: updatedSubmission });
  } catch (error) {
    console.error("Error adjusting score:", error);
    return NextResponse.json(
      { error: "Failed to adjust score" },
      { status: 500 }
    );
  }
}
