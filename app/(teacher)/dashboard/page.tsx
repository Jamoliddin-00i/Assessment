import Link from "next/link";
import { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default async function TeacherDashboard() {
    await requireRole(Role.TEACHER);
    const classes = await prisma.class.findMany({
        include: { assessments: true },
        orderBy: { updatedAt: "desc" },
    });

    return (
        <div className="container space-y-6 py-8">
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-semibold">Teacher Dashboard</h1>
                <Link href="/classes/new">
                    <Button>Create Class</Button>
                </Link>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
                {classes.map((cls) => (
                    <Card
                        key={cls.id}
                        className="transition hover:-translate-y-1 hover:shadow-lg"
                    >
                        <CardHeader>
                            <CardTitle className="flex items-center justify-between">
                                <span>{cls.name}</span>
                                <span className="text-xs text-muted-foreground">
                                    Code: {cls.code}
                                </span>
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            <p className="text-sm text-muted-foreground">
                                {cls.assessments.length} assessments
                            </p>
                            <Link
                                className="text-primary underline"
                                href={`/teacher/classes/${cls.id}`}
                            >
                                Manage class
                            </Link>
                        </CardContent>
                    </Card>
                ))}
            </div>
        </div>
    );
}
