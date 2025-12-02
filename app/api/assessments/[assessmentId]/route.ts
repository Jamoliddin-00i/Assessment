import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { Role } from "@prisma/client";

export async function GET(
    _req: Request,
    { params }: { params: { assessmentId: string } }
) {
    await requireRole(Role.TEACHER);
    const assessment = await prisma.assessment.findUnique({
        where: { id: params.assessmentId },
        include: {
            class: true,
            questions: { include: { markScheme: true } },
            submissions: { include: { student: true, questionResults: true } },
        },
    });

    if (!assessment) {
        return NextResponse.json({ message: "Not found" }, { status: 404 });
    }

    return NextResponse.json(assessment);
}
