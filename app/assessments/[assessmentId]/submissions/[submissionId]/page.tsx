"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Navbar } from "@/components/navbar";
import { useSession } from "next-auth/react";

interface Result {
    id: string;
    question: {
        questionNumber: string;
        text: string;
        maxMarks: number;
    };
    awardedMarks: number;
    feedback: string;
}

interface Submission {
    id: string;
    totalMarks: number;
    results: Result[];
}

export default function SubmissionResultPage() {
    const { data: session } = useSession();
    const params = useParams();
    const [submission, setSubmission] = useState<Submission | null>(null);

    useEffect(() => {
        const fetchSubmission = async () => {
            try {
                const res = await fetch(`/api/submissions/${params.submissionId}`);
                if (res.ok) {
                    const data = await res.json();
                    setSubmission(data);
                }
            } catch (error) {
                console.error(error);
            }
        };

        if (params.submissionId) {
            fetchSubmission();
        }
    }, [params.submissionId]);

    if (!session || !submission) return null;

    return (
        <div className="min-h-screen bg-background">
            <Navbar user={session.user} />
            <div className="container py-8 space-y-8">
                <h1 className="text-3xl font-bold">Grading Results</h1>
                <div className="text-xl">Total Marks: {submission.totalMarks}</div>

                <div className="space-y-4">
                    {submission.results.map((res) => (
                        <Card key={res.id}>
                            <CardHeader>
                                <CardTitle className="flex justify-between">
                                    <span>Question {res.question.questionNumber}</span>
                                    <span>{res.awardedMarks} / {res.question.maxMarks}</span>
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <p className="font-medium mb-2">{res.question.text}</p>
                                <div className="bg-muted p-4 rounded-md text-sm">
                                    <p className="font-semibold">AI Feedback:</p>
                                    <p>{res.feedback}</p>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            </div>
        </div>
    );
}
