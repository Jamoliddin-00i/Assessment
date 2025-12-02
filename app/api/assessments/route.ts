import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { Role, Strictness } from "@prisma/client";

export async function GET() {
    await requireRole(Role.TEACHER);
    const assessments = await prisma.assessment.findMany({
        include: { class: true, questions: true },
    });
    return NextResponse.json(assessments);
}

export async function POST(req: Request) {
    await requireRole(Role.TEACHER);
    const body = await req.json();

    const assessment = await prisma.assessment.create({
        data: {
            classId: body.classId,
            title: body.title,
            description: body.description,
            strictness: body.strictness as Strictness,
            totalMarks: body.totalMarks,
            date: new Date(body.date),
            questions: {
                create: (body.questions || []).map((q: any) => ({
                    questionNumber: q.questionNumber,
                    text: q.text,
                    maxMarks: q.maxMarks,
                    markScheme: { create: q.markSchemePoints || [] },
                })),
            },
        },
        include: { questions: { include: { markScheme: true } } },
    });

    return NextResponse.json(assessment);
}
