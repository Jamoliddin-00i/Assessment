import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { Role } from "@prisma/client";

export async function GET(
    _req: Request,
    { params }: { params: { assessmentId: string } }
) {
    await requireRole(Role.TEACHER);
    const questions = await prisma.question.findMany({
        where: { assessmentId: params.assessmentId },
        include: { markScheme: true },
        orderBy: { questionNumber: "asc" },
    });
    return NextResponse.json(questions);
}

export async function POST(
    req: Request,
    { params }: { params: { assessmentId: string } }
) {
    await requireRole(Role.TEACHER);
    const { questionNumber, text, maxMarks } = await req.json();
    const question = await prisma.question.create({
        data: {
            assessmentId: params.assessmentId,
            questionNumber,
            text,
            maxMarks,
        },
        include: { markScheme: true },
    });
    return NextResponse.json(question, { status: 201 });
}
