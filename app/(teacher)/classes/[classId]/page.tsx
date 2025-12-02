import Link from "next/link";
import { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function ClassPage({
    params,
}: {
    params: { classId: string };
}) {
    await requireRole(Role.TEACHER);
    const cls = await prisma.class.findUnique({
        where: { id: params.classId },
        include: {
            memberships: { include: { student: true } },
            assessments: true,
        },
    });
    if (!cls) return <div className="p-6">Class not found</div>;

    return (
        <div className="container space-y-4 py-8">
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-semibold">{cls.name}</h1>
                <span className="text-sm text-muted-foreground">
                    Join code: {cls.code}
                </span>
            </div>
            <Card>
                <CardHeader>
                    <CardTitle>Students</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                    {cls.memberships.map((m) => (
                        <div
                            key={m.id}
                            className="flex justify-between text-sm text-muted-foreground"
                        >
                            <span>{m.student.name}</span>
                            <span>{m.student.email}</span>
                        </div>
                    ))}
                </CardContent>
            </Card>
            <Card>
                <CardHeader>
                    <CardTitle>Assessments</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                    {cls.assessments.map((a) => (
                        <Link
                            key={a.id}
                            className="text-primary underline"
                            href={`/teacher/assessments/${a.id}`}
                        >
                            {a.title}
                        </Link>
                    ))}
                </CardContent>
            </Card>
        </div>
    );
}
