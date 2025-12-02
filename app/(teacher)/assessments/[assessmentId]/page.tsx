import { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function AssessmentPage({
    params,
}: {
    params: { assessmentId: string };
}) {
    await requireRole(Role.TEACHER);
    const assessment = await prisma.assessment.findUnique({
        where: { id: params.assessmentId },
        include: {
            questions: { include: { markScheme: true } },
            submissions: { include: { student: true } },
            class: true,
        },
    });
    if (!assessment) return <div className="p-6">Not found</div>;

    return (
        <div className="container space-y-4 py-8">
            <div>
                <h1 className="text-2xl font-semibold">{assessment.title}</h1>
                <p className="text-muted-foreground">{assessment.description}</p>
            </div>
            <Card>
                <CardHeader>
                    <CardTitle>Questions</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                    {assessment.questions.map((q) => (
                        <div key={q.id} className="text-sm">
                            <div className="font-semibold">
                                {q.questionNumber}. {q.text} ({q.maxMarks})
                            </div>
                            <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
                                {q.markScheme.map((p) => (
                                    <li key={p.id}>
                                        {p.ideaText} (+{p.marks})
                                    </li>
                                ))}
                            </ul>
                        </div>
                    ))}
                </CardContent>
            </Card>
            <Card>
                <CardHeader>
                    <CardTitle>Submissions</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                    {assessment.submissions.map((s) => (
                        <div
                            key={s.id}
                            className="flex justify-between border-b pb-2 last:border-none last:pb-0"
                        >
                            <span>{s.student.name}</span>
                            <span>
                                {s.status}{" "}
                                {s.totalMarks
                                    ? `(${s.totalMarks}/${assessment.totalMarks})`
                                    : ""}
                            </span>
                        </div>
                    ))}
                </CardContent>
            </Card>
        </div>
    );
}
