import { NextRequest, NextResponse } from "next/server";
import { Role, SubmissionStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { saveUpload } from "@/lib/storage";
import { OcrService } from "@/lib/services/OcrService";
import { GradingService } from "@/lib/services/GradingService";

export async function POST(req: NextRequest) {
    const session = await requireRole(Role.TEACHER);
    const { searchParams } = new URL(req.url);
    const assessmentId = searchParams.get("assessmentId");
    const studentId = searchParams.get("studentId");

    if (!assessmentId || !studentId) {
        return NextResponse.json({ error: "Missing ids" }, { status: 400 });
    }

    const saved = await saveUpload(req);

    const submission = await prisma.submission.create({
        data: {
            assessmentId,
            studentId,
            status: SubmissionStatus.PENDING,
        },
    });

    await prisma.submissionFile.create({
        data: {
            submissionId: submission.id,
            filePath: saved.filePath,
            originalName: saved.originalName,
            mimeType: saved.mimeType,
        },
    });

    const ocr = await OcrService.extractTextFromFiles([Buffer.from("")]);
    const graded = await GradingService.gradeSubmission({
        assessmentId,
        submissionId: submission.id,
        ocrText: ocr.text,
    });

    for (const result of graded) {
        await prisma.questionResult.create({
            data: {
                submissionId: submission.id,
                questionId: result.questionId,
                awardedMarks: result.awardedMarks,
                aiConfidence: result.aiConfidence ?? null,
                ocrText: result.ocrText ?? null,
                feedback: result.feedback ?? null,
            },
        });
    }

    const total = graded.reduce((sum, g) => sum + g.awardedMarks, 0);
    await prisma.submission.update({
        where: { id: submission.id },
        data: { status: SubmissionStatus.GRADED, totalMarks: total },
    });

    return NextResponse.json({ submissionId: submission.id, totalMarks: total });
}
