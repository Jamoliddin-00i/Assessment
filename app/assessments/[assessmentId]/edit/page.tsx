"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Navbar } from "@/components/navbar";
import { useSession } from "next-auth/react";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Trash } from "lucide-react";

interface Question {
    id: string;
    questionNumber: string;
    text: string;
    maxMarks: number;
    markScheme: {
        id: string;
        ideaText: string;
        marks: number;
    }[];
}

export default function EditAssessmentPage() {
    const { data: session } = useSession();
    const params = useParams();
    const [questions, setQuestions] = useState<Question[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (params.assessmentId) {
            fetchQuestions();
        }
    }, [params.assessmentId]);

    const fetchQuestions = async () => {
        try {
            const res = await fetch(`/api/assessments/${params.assessmentId}/questions`);
            if (res.ok) {
                const data = await res.json();
                setQuestions(data);
            }
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const addQuestion = async () => {
        // Optimistic update or API call
        // For simplicity, we'll just add to local state and save individually or have a "Save All"
        // Better to save individually to DB to avoid data loss
        try {
            const res = await fetch(`/api/assessments/${params.assessmentId}/questions`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    questionNumber: `${questions.length + 1}`,
                    text: "New Question",
                    maxMarks: 10,
                }),
            });
            if (res.ok) {
                const newQ = await res.json();
                setQuestions([...questions, newQ]);
            }
        } catch (error) {
            console.error(error);
        }
    };

    return (
        <div className="min-h-screen bg-background">
            <Navbar user={session?.user || { role: "TEACHER" }} />
            <div className="container py-8 space-y-8">
                <div className="flex items-center justify-between">
                    <h1 className="text-3xl font-bold">Edit Assessment Questions</h1>
                    <Button onClick={addQuestion}>
                        <Plus className="mr-2 h-4 w-4" /> Add Question
                    </Button>
                </div>

                <div className="space-y-4">
                    {questions.map((q, index) => (
                        <Card key={q.id}>
                            <CardHeader>
                                <CardTitle className="flex justify-between">
                                    <span>Question {q.questionNumber}</span>
                                    <span className="text-sm font-normal text-muted-foreground">Max Marks: {q.maxMarks}</span>
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <p>{q.text}</p>
                                {/* Add edit functionality here */}
                            </CardContent>
                        </Card>
                    ))}
                </div>
            </div>
        </div>
    );
}
