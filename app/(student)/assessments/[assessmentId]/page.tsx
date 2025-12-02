import { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function StudentAssessment({
    params,
}: {
    params: { assessmentId: string };
}) {
    const session = await requireRole(Role.STUDENT);
    const assessment = await prisma.assessment.findUnique({
        where: { id: params.assessmentId },
        include: {
            questions: true,
            submissions: {
                where: { studentId: (session.user as any).id },
                include: { questionResults: true },
            },
        },
    });
    if (!assessment) return <div className="p-6">Not found</div>;

    const submission = assessment.submissions[0];

    return (
        <div className="container space-y-4 py-8">
            <div>
                <h1 className="text-2xl font-semibold">{assessment.title}</h1>
                <p className="text-muted-foreground">{assessment.description}</p>
            </div>
            {submission ? (
                <Card>
                    <CardHeader>
                        <CardTitle>Results</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3 text-sm">
                        <div className="flex justify-between">
                            <span>Status: {submission.status}</span>
                            <span>
                                Total: {submission.totalMarks ?? "-"} /{" "}
                                {assessment.totalMarks}
                            </span>
                        </div>
                        {submission.questionResults.map((qr) => (
                            <div
                                key={qr.id}
                                className="rounded-md border p-3"
                            >
                                <div className="font-semibold">
                                    Question {qr.questionId}
                                </div>
                                <div>Marks: {qr.awardedMarks}</div>
                                {qr.feedback && (
                                    <div className="text-muted-foreground">
                                        Feedback: {qr.feedback}
                                    </div>
                                )}
                            </div>
                        ))}
                    </CardContent>
                </Card>
            ) : (
                <Card>
                    <CardContent>No submission yet.</CardContent>
                </Card>
            )}
        </div>
    );
}
