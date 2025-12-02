import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(
    _req: Request,
    { params }: { params: { submissionId: string } }
) {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

    const submission = await prisma.submission.findUnique({
        where: { id: params.submissionId },
        include: {
            questionResults: {
                include: { question: true },
                orderBy: { question: { questionNumber: "asc" } },
            },
        },
    });

    if (!submission) return NextResponse.json({ message: "Not found" }, { status: 404 });

    if (session.user.role === "STUDENT" && submission.studentId !== session.user.id) {
        return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    }

    return NextResponse.json(submission);
}
