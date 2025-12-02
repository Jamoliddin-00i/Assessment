"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LogIn } from "lucide-react";

interface Class {
    id: string;
    name: string;
    teacher: {
        name: string;
    };
}

export function StudentDashboard() {
    const [classes, setClasses] = useState<Class[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchClasses();
    }, []);

    const fetchClasses = async () => {
        try {
            const res = await fetch("/api/student/classes");
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
                <h2 className="text-3xl font-bold tracking-tight">My Classes</h2>
                <Button asChild variant="outline">
                    <Link href="/join-class">
                        <LogIn className="mr-2 h-4 w-4" /> Join Class
                    </Link>
                </Button>
            </div>

            {loading ? (
                <div>Loading classes...</div>
            ) : classes.length === 0 ? (
                <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-8 text-center animate-in fade-in-50">
                    <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-secondary">
                        <LogIn className="h-6 w-6 text-secondary-foreground" />
                    </div>
                    <h3 className="mt-4 text-lg font-semibold">No classes joined</h3>
                    <p className="mb-4 mt-2 text-sm text-muted-foreground">
                        You haven&apos;t joined any classes yet. Join one with a code.
                    </p>
                    <Button asChild>
                        <Link href="/join-class">Join Class</Link>
                    </Button>
                </div>
            ) : (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {classes.map((cls) => (
                        <Card key={cls.id} className="hover:shadow-md transition-shadow">
                            <CardHeader>
                                <CardTitle>{cls.name}</CardTitle>
                                <CardDescription>Teacher: {cls.teacher.name}</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <Button asChild className="w-full" variant="secondary">
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
