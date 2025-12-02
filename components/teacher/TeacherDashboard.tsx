"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus } from "lucide-react";

interface Class {
    id: string;
    name: string;
    code: string;
    _count: {
        students: number;
        assessments: number;
    };
}

export function TeacherDashboard() {
    const [classes, setClasses] = useState<Class[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchClasses();
    }, []);

    const fetchClasses = async () => {
        try {
            const res = await fetch("/api/classes");
            if (res.ok) {
                const data = await res.json();
                setClasses(data);
            }
        } catch (error) {
            console.error("Failed to fetch classes", error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h2 className="text-3xl font-bold tracking-tight">Dashboard</h2>
                <Button asChild>
                    <Link href="/classes/new">
                        <Plus className="mr-2 h-4 w-4" /> Create Class
                    </Link>
                </Button>
            </div>

            {loading ? (
                <div>Loading classes...</div>
            ) : classes.length === 0 ? (
                <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-8 text-center animate-in fade-in-50">
                    <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-secondary">
                        <Plus className="h-6 w-6 text-secondary-foreground" />
                    </div>
                    <h3 className="mt-4 text-lg font-semibold">No classes created</h3>
                    <p className="mb-4 mt-2 text-sm text-muted-foreground">
                        You haven&apos;t created any classes yet. Create one to get started.
                    </p>
                    <Button asChild>
                        <Link href="/classes/new">Create Class</Link>
                    </Button>
                </div>
            ) : (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {classes.map((cls) => (
                        <Card key={cls.id} className="hover:shadow-md transition-shadow">
                            <CardHeader>
                                <CardTitle>{cls.name}</CardTitle>
                                <CardDescription>Code: {cls.code}</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="flex justify-between text-sm text-muted-foreground">
                                    <span>{cls._count?.students || 0} Students</span>
                                    <span>{cls._count?.assessments || 0} Assessments</span>
                                </div>
                                <Button asChild className="mt-4 w-full" variant="secondary">
                                    <Link href={`/classes/${cls.id}`}>View Class</Link>
                                </Button>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}
        </div>
    );
}
