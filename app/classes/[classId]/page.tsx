"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Navbar } from "@/components/navbar";
import { useSession } from "next-auth/react";
import { Plus, Users, FileText } from "lucide-react";

interface ClassDetails {
    id: string;
    name: string;
    code: string;
    students: {
        student: {
            id: string;
            name: string;
            email: string;
        };
    }[];
    assessments: {
        id: string;
        title: string;
        date: string;
        status: string; // derived
    }[];
}

export default function ClassDetailsPage() {
    const { data: session } = useSession();
    const params = useParams();
    const [classData, setClassData] = useState<ClassDetails | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (params.classId) {
            fetchClassDetails(params.classId as string);
        }
    }, [params.classId]);

    const fetchClassDetails = async (id: string) => {
        try {
            const res = await fetch(`/api/classes/${id}`);
            if (res.ok) {
                const data = await res.json();
                setClassData(data);
            }
        } catch (error) {
            console.error("Failed to fetch class details", error);
        } finally {
            setLoading(false);
        }
    };

    if (!session) return null;

    if (loading) return <div className="p-8">Loading...</div>;
    if (!classData) return <div className="p-8">Class not found</div>;

    return (
        <div className="min-h-screen bg-background">
            <Navbar user={session.user} />
            <div className="container py-8 space-y-8">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-bold">{classData.name}</h1>
                        <p className="text-muted-foreground">Class Code: {classData.code}</p>
                    </div>
                    {session.user.role === "TEACHER" && (
                        <Button asChild>
                            <Link href={`/classes/${classData.id}/assessments/new`}>
                                <Plus className="mr-2 h-4 w-4" /> Create Assessment
                            </Link>
                        </Button>
                    )}
                </div>

                <div className="grid gap-6 md:grid-cols-2">
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center">
                                <FileText className="mr-2 h-5 w-5" /> Assessments
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            {classData.assessments.length === 0 ? (
                                <p className="text-sm text-muted-foreground">No assessments yet.</p>
                            ) : (
                                <div className="space-y-4">
                                    {classData.assessments.map((assessment) => (
                                        <div key={assessment.id} className="flex items-center justify-between border-b pb-2 last:border-0">
                                            <div>
                                                <p className="font-medium">{assessment.title}</p>
                                                <p className="text-xs text-muted-foreground">
                                                    {new Date(assessment.date).toLocaleDateString()}
                                                </p>
                                            </div>
                                            <Button variant="ghost" size="sm" asChild>
                                                <Link href={`/assessments/${assessment.id}`}>View</Link>
                                            </Button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center">
                                <Users className="mr-2 h-5 w-5" /> Students
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            {classData.students.length === 0 ? (
                                <p className="text-sm text-muted-foreground">No students joined yet.</p>
                            ) : (
                                <div className="space-y-4">
                                    {classData.students.map((membership) => (
                                        <div key={membership.student.id} className="flex items-center justify-between border-b pb-2 last:border-0">
                                            <div>
                                                <p className="font-medium">{membership.student.name}</p>
                                                <p className="text-xs text-muted-foreground">{membership.student.email}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}
