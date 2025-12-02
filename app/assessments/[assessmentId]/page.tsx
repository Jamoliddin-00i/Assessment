"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Navbar } from "@/components/navbar";
import { useSession } from "next-auth/react";
import { Upload, FileText, CheckCircle } from "lucide-react";

interface Assessment {
    id: string;
    title: string;
    description: string;
    totalMarks: number;
    submissions: {
        id: string;
        student: { name: string };
        status: string;
        totalMarks: number | null;
    }[];
}

export default function AssessmentDetailsPage() {
    const { data: session } = useSession();
    const params = useParams();
    const [assessment, setAssessment] = useState<Assessment | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (params.assessmentId) {
            fetchAssessment();
        }
    }, [params.assessmentId]);

    const fetchAssessment = async () => {
        try {
            const res = await fetch(`/api/assessments/${params.assessmentId}`);
            if (res.ok) {
                const data = await res.json();
                setAssessment(data);
            }
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    if (!session) return null;
    if (loading) return <div className="p-8">Loading...</div>;
    if (!assessment) return <div className="p-8">Assessment not found</div>;

    return (
        <div className="min-h-screen bg-background">
            <Navbar user={session.user} />
            <div className="container py-8 space-y-8">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-bold">{assessment.title}</h1>
                        <p className="text-muted-foreground">{assessment.description}</p>
                    </div>
                    {session.user.role === "TEACHER" && (
                        <div className="space-x-2">
                            <Button variant="outline" asChild>
                                <Link href={`/assessments/${assessment.id}/edit`}>Edit Questions</Link>
                            </Button>
                            <Button asChild>
                                <Link href={`/assessments/${assessment.id}/submissions/new`}>
                                    <Upload className="mr-2 h-4 w-4" /> Upload Submission
                                </Link>
                            </Button>
                        </div>
                    )}
                </div>

                <Card>
                    <CardHeader>
                        <CardTitle>Submissions</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {assessment.submissions.length === 0 ? (
                            <p className="text-sm text-muted-foreground">No submissions yet.</p>
                        ) : (
                            <div className="space-y-4">
                                {assessment.submissions.map((sub) => (
                                    <div key={sub.id} className="flex items-center justify-between border-b pb-2 last:border-0">
                                        <div>
                                            <p className="font-medium">{sub.student.name}</p>
                                            <p className="text-xs text-muted-foreground">Status: {sub.status}</p>
                                        </div>
                                        <div className="flex items-center space-x-4">
                                            {sub.totalMarks !== null && (
                                                <span className="font-bold">{sub.totalMarks} / {assessment.totalMarks}</span>
                                            )}
                                            <Button variant="ghost" size="sm" asChild>
                                                <Link href={`/assessments/${assessment.id}/submissions/${sub.id}`}>
                                                    View Result
                                                </Link>
                                            </Button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
