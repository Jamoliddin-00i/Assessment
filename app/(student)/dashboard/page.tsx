import Link from "next/link";
import { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function StudentDashboard() {
    const session = await requireRole(Role.STUDENT);
    const memberships = await prisma.classMembership.findMany({
        where: { studentId: (session.user as any).id },
        include: { class: { include: { assessments: true } } },
    });

    return (
        <div className="container space-y-4 py-8">
            <h1 className="text-2xl font-semibold">My Classes</h1>
            <div className="grid gap-4 md:grid-cols-3">
                {memberships.map((m) => (
                    <Card key={m.id}>
                        <CardHeader>
                            <CardTitle className="flex items-center justify-between">
                                <span>{m.class.name}</span>
                                <span className="text-xs text-muted-foreground">
                                    Code {m.class.code}
                                </span>
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-1 text-sm">
                            {m.class.assessments.map((a) => (
                                <Link
                                    key={a.id}
                                    className="text-primary underline"
                                    href={`/student/assessments/${a.id}`}
                                >
                                    {a.title}
                                </Link>
                            ))}
                        </CardContent>
                    </Card>
                ))}
            </div>
        </div>
    );
}
