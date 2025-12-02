"use client";

import { useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Navbar } from "@/components/navbar";
import { useSession } from "next-auth/react";
import { Textarea } from "@/components/ui/textarea"; // Need to create Textarea
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"; // Need to create Select

export default function CreateAssessmentPage() {
    const { data: session } = useSession();
    const router = useRouter();
    const params = useParams();
    const [title, setTitle] = useState("");
    const [description, setDescription] = useState("");
    const [totalMarks, setTotalMarks] = useState(100);
    const [strictness, setStrictness] = useState("FAIR");
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            const res = await fetch("/api/assessments", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    classId: params.classId,
                    title,
                    description,
                    totalMarks,
                    strictness,
                    date: new Date().toISOString(),
                }),
            });

            if (!res.ok) throw new Error("Failed to create assessment");

            const data = await res.json();
            router.push(`/assessments/${data.id}/edit`); // Redirect to edit questions
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    if (!session) return null;

    return (
        <div className="min-h-screen bg-background">
            <Navbar user={session.user} />
            <div className="container flex items-center justify-center py-12">
                <Card className="w-full max-w-2xl">
                    <CardHeader>
                        <CardTitle>Create Assessment</CardTitle>
                        <CardDescription>Define the basic details of the assessment.</CardDescription>
                    </CardHeader>
                    <form onSubmit={handleSubmit}>
                        <CardContent className="space-y-4">
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Title</label>
                                <Input value={title} onChange={(e) => setTitle(e.target.value)} required />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Description</label>
                                <textarea
                                    className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                    value={description}
                                    onChange={(e) => setDescription(e.target.value)}
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Total Marks</label>
                                    <Input
                                        type="number"
                                        value={totalMarks}
                                        onChange={(e) => setTotalMarks(parseInt(e.target.value))}
                                        required
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Strictness</label>
                                    <select
                                        className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                        value={strictness}
                                        onChange={(e) => setStrictness(e.target.value)}
                                    >
                                        <option value="STRICT">Strict</option>
                                        <option value="FAIR">Fair</option>
                                        <option value="EASY">Easy</option>
                                    </select>
                                </div>
                            </div>
                        </CardContent>
                        <CardFooter>
                            <Button type="submit" disabled={loading}>
                                {loading ? "Creating..." : "Next: Add Questions"}
                            </Button>
                        </CardFooter>
                    </form>
                </Card>
            </div>
        </div>
    );
}
