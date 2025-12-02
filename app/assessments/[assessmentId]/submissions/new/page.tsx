"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Navbar } from "@/components/navbar";
import { useSession } from "next-auth/react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";

interface Student {
    id: string;
    name: string;
}

export default function UploadSubmissionPage() {
    const { data: session } = useSession();
    const params = useParams();
    const router = useRouter();
    const [students, setStudents] = useState<Student[]>([]);
    const [selectedStudent, setSelectedStudent] = useState("");
    const [file, setFile] = useState<File | null>(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        // Fetch students in the class of this assessment
        // We need to fetch assessment first to get classId, then students
        // Or just fetch assessment with class.students
        fetchAssessmentDetails();
    }, [params.assessmentId]);

    const fetchAssessmentDetails = async () => {
        try {
            // Fetch assessment to get the related class, then list students from that class
            const resAss = await fetch(`/api/assessments/${params.assessmentId}`);
            if (resAss.ok) {
                const ass: { classId: string } = await resAss.json();
                const resClass = await fetch(`/api/classes/${ass.classId}`);
                if (resClass.ok) {
                    const cls: { students: { student: Student }[] } = await resClass.json();
                    setStudents(cls.students.map((s) => s.student));
                }
            }
        } catch (error) {
            console.error(error);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!file || !selectedStudent) return;
        setLoading(true);

        const formData = new FormData();
        formData.append("file", file);
        formData.append("assessmentId", params.assessmentId as string);
        formData.append("studentId", selectedStudent);

        try {
            const res = await fetch("/api/submissions/upload", {
                method: "POST",
                body: formData,
            });

            if (res.ok) {
                router.push(`/assessments/${params.assessmentId}`);
            }
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
            <div className="container py-8 flex justify-center">
                <Card className="w-full max-w-md">
                    <CardHeader>
                        <CardTitle>Upload Submission</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Select Student</label>
                                <Select onValueChange={setSelectedStudent} value={selectedStudent}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select a student" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {students.map((s) => (
                                            <SelectItem key={s.id} value={s.id}>
                                                {s.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium">File (Image/PDF)</label>
                                <Input
                                    type="file"
                                    onChange={(e) => setFile(e.target.files?.[0] || null)}
                                    accept="image/*,application/pdf"
                                    required
                                />
                            </div>
                            <Button type="submit" className="w-full" disabled={loading}>
                                {loading ? "Uploading & Grading..." : "Upload & Grade"}
                            </Button>
                        </form>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
