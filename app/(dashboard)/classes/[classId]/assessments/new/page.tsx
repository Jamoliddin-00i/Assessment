"use client";

import { useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, FileText, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";

export default function NewAssessmentPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const classId = params.classId as string;
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [title, setTitle] = useState("");
  const [totalMarks, setTotalMarks] = useState("");
  const [markSchemePdf, setMarkSchemePdf] = useState<File | null>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.type !== "application/pdf") {
        toast({
          title: "Invalid file type",
          description: "Please select a PDF file for the mark scheme.",
          variant: "destructive",
        });
        return;
      }
      setMarkSchemePdf(file);
    }
  };

  const handleRemoveFile = () => {
    setMarkSchemePdf(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!title.trim()) {
      toast({
        title: "Title required",
        description: "Please enter an assessment title.",
        variant: "destructive",
      });
      return;
    }

    if (!markSchemePdf) {
      toast({
        title: "Mark scheme required",
        description: "Please upload a PDF file containing the mark scheme.",
        variant: "destructive",
      });
      return;
    }

    if (!totalMarks || parseInt(totalMarks) <= 0) {
      toast({
        title: "Total marks required",
        description: "Please enter a valid total marks value.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      const formData = new FormData();
      formData.append("title", title);
      formData.append("totalMarks", totalMarks);
      formData.append("markSchemePdf", markSchemePdf);

      const response = await fetch(`/api/classes/${classId}/assessments`, {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to create assessment");
      }

      toast({
        title: "Assessment created!",
        description: "You can now submit student work for grading.",
        variant: "success",
      });

      router.push(`/assessments/${data.assessment.id}`);
    } catch (error) {
      toast({
        title: "Failed to create assessment",
        description: error instanceof Error ? error.message : "Something went wrong",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Link href={`/classes/${classId}`}>
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            Create New Assessment
          </h1>
          <p className="text-muted-foreground">
            Set up an assessment and upload the mark scheme
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Assessment Details</CardTitle>
          <CardDescription>
            Upload a PDF mark scheme. The AI will extract the grading criteria
            and use it to evaluate student submissions.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="title">Assessment Title *</Label>
              <Input
                id="title"
                placeholder="e.g., Chapter 5 Quiz"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="totalMarks">Total Marks *</Label>
              <Input
                id="totalMarks"
                type="number"
                min="1"
                placeholder="e.g., 100"
                value={totalMarks}
                onChange={(e) => setTotalMarks(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label>Mark Scheme (PDF) *</Label>
              <p className="text-sm text-muted-foreground">
                Upload a PDF containing the mark scheme. The AI will extract the
                grading criteria from this document.
              </p>

              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,application/pdf"
                onChange={handleFileSelect}
                className="hidden"
                id="markSchemePdf"
              />

              {!markSchemePdf ? (
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:border-primary hover:bg-accent/50 transition-colors"
                >
                  <Upload className="h-10 w-10 mx-auto text-muted-foreground mb-4" />
                  <p className="text-sm font-medium">Click to upload mark scheme PDF</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    PDF files only
                  </p>
                </div>
              ) : (
                <div className="border rounded-lg p-4 flex items-center justify-between bg-accent/30">
                  <div className="flex items-center gap-3">
                    <FileText className="h-8 w-8 text-primary" />
                    <div>
                      <p className="font-medium text-sm">{markSchemePdf.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {(markSchemePdf.size / 1024).toFixed(1)} KB
                      </p>
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={handleRemoveFile}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>

            <div className="flex gap-4 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => router.back()}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? "Creating..." : "Create Assessment"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
