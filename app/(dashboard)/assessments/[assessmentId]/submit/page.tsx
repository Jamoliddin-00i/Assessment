"use client";

import { useState, useCallback, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { useDropzone } from "react-dropzone";
import { ArrowLeft, Upload, FileImage, X, Loader2, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";

interface Student {
  id: string;
  name: string;
  email: string;
}

interface Assessment {
  id: string;
  title: string;
  class: {
    id: string;
    enrollments: {
      student: Student;
    }[];
  };
  submissions: {
    studentId: string;
  }[];
}

export default function SubmitAssessmentPage() {
  const params = useParams();
  const router = useRouter();
  const { data: session } = useSession();
  const { toast } = useToast();
  const [uploading, setUploading] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [selectedStudentId, setSelectedStudentId] = useState<string>("");
  const [assessment, setAssessment] = useState<Assessment | null>(null);
  const [loading, setLoading] = useState(true);

  const assessmentId = params.assessmentId as string;
  const isTeacher = session?.user?.role === "TEACHER";

  useEffect(() => {
    fetchAssessment();
  }, [assessmentId]);

  const fetchAssessment = async () => {
    try {
      const response = await fetch(`/api/assessments/${assessmentId}`);
      if (!response.ok) throw new Error("Failed to fetch assessment");
      const data = await response.json();
      setAssessment(data.assessment);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to load assessment details",
        variant: "destructive",
      });
      router.push("/dashboard");
    } finally {
      setLoading(false);
    }
  };

  // Get students who haven't submitted yet
  const studentsWithoutSubmission = assessment?.class.enrollments.filter(
    (enrollment) =>
      !assessment.submissions.some((sub) => sub.studentId === enrollment.student.id)
  ) || [];

  // Get all students for selection (including those who already submitted - for re-submission)
  const allStudents = assessment?.class.enrollments.map((e) => e.student) || [];

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const newFiles = [...selectedFiles, ...acceptedFiles];
    setSelectedFiles(newFiles);

    // Create previews for new files
    acceptedFiles.forEach((file) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreviews((prev) => [...prev, reader.result as string]);
      };
      reader.readAsDataURL(file);
    });
  }, [selectedFiles]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "image/*": [".png", ".jpg", ".jpeg", ".gif", ".webp"],
    },
    maxSize: 10 * 1024 * 1024, // 10MB per file
  });

  const removeFile = (index: number) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
    setPreviews((prev) => prev.filter((_, i) => i !== index));
  };

  const clearAllFiles = () => {
    setSelectedFiles([]);
    setPreviews([]);
  };

  const handleSubmit = async () => {
    if (!selectedStudentId) {
      toast({
        title: "No student selected",
        description: "Please select which student's work you are uploading",
        variant: "destructive",
      });
      return;
    }

    if (selectedFiles.length === 0) {
      toast({
        title: "No files selected",
        description: "Please upload images of the student's work",
        variant: "destructive",
      });
      return;
    }

    setUploading(true);

    try {
      const formData = new FormData();
      selectedFiles.forEach((file) => {
        formData.append("files", file);
      });
      formData.append("assessmentId", assessmentId);
      formData.append("studentId", selectedStudentId);

      const response = await fetch("/api/submissions/upload", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to upload submission");
      }

      toast({
        title: "Submission uploaded!",
        description: "The work is being processed and graded. This may take a moment.",
        variant: "success",
      });

      // Clear form and refresh
      clearAllFiles();
      setSelectedStudentId("");
      fetchAssessment();
    } catch (error) {
      toast({
        title: "Upload failed",
        description: error instanceof Error ? error.message : "Something went wrong",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  // Only teachers can access this page
  if (!isTeacher) {
    return (
      <div className="max-w-2xl mx-auto text-center py-12">
        <h1 className="text-2xl font-bold mb-4">Access Denied</h1>
        <p className="text-muted-foreground mb-6">
          Only teachers can submit student work for grading.
        </p>
        <Link href={`/assessments/${assessmentId}`}>
          <Button>Back to Assessment</Button>
        </Link>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Link href={`/assessments/${assessmentId}`}>
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            Submit Student Work
          </h1>
          <p className="text-muted-foreground">
            {assessment?.title} - Upload student&apos;s handwritten work for grading
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Select Student</CardTitle>
          <CardDescription>
            Choose which student&apos;s work you are uploading
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Label htmlFor="student">Student *</Label>
            <Select value={selectedStudentId} onValueChange={setSelectedStudentId}>
              <SelectTrigger>
                <SelectValue placeholder="Select a student" />
              </SelectTrigger>
              <SelectContent>
                {allStudents.map((student) => {
                  const hasSubmission = assessment?.submissions.some(
                    (sub) => sub.studentId === student.id
                  );
                  return (
                    <SelectItem key={student.id} value={student.id}>
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4" />
                        <span>{student.name}</span>
                        {hasSubmission && (
                          <span className="text-xs text-muted-foreground ml-2">
                            (will replace existing)
                          </span>
                        )}
                      </div>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
            {studentsWithoutSubmission.length > 0 && (
              <p className="text-xs text-muted-foreground">
                {studentsWithoutSubmission.length} student(s) haven&apos;t submitted yet
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Upload Images</CardTitle>
          <CardDescription>
            Upload images of the student&apos;s handwritten work. You can upload
            multiple pages.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div
            {...getRootProps()}
            className={`dropzone cursor-pointer ${
              isDragActive ? "dropzone-active" : "border-border"
            }`}
          >
            <input {...getInputProps()} />
            <div className="flex flex-col items-center gap-4">
              <div className="p-4 rounded-full bg-primary/10">
                <Upload className="h-8 w-8 text-primary" />
              </div>
              {isDragActive ? (
                <p className="text-lg font-medium">Drop your images here...</p>
              ) : (
                <>
                  <div className="text-center">
                    <p className="text-lg font-medium">
                      Drag and drop images here
                    </p>
                    <p className="text-sm text-muted-foreground">
                      or click to browse
                    </p>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Supported formats: PNG, JPG, JPEG, GIF, WebP (max 10MB each)
                  </p>
                </>
              )}
            </div>
          </div>

          {selectedFiles.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="font-medium">
                  Selected Files ({selectedFiles.length})
                </h4>
                <Button variant="outline" size="sm" onClick={clearAllFiles}>
                  Clear All
                </Button>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {selectedFiles.map((file, index) => (
                  <div key={index} className="relative group">
                    <img
                      src={previews[index]}
                      alt={`Preview ${index + 1}`}
                      className="w-full aspect-[3/4] object-cover rounded-lg border"
                    />
                    <Button
                      variant="destructive"
                      size="icon"
                      className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity h-8 w-8"
                      onClick={() => removeFile(index)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                    <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-xs p-2 rounded-b-lg truncate">
                      {file.name}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex gap-4 pt-4">
            <Button
              variant="outline"
              onClick={() => router.back()}
              disabled={uploading}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={!selectedStudentId || selectedFiles.length === 0 || uploading}
              className="flex-1"
            >
              {uploading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Uploading & Processing...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-2" />
                  Submit Work ({selectedFiles.length} image{selectedFiles.length !== 1 ? "s" : ""})
                </>
              )}
            </Button>
          </div>

          <div className="pt-4 border-t">
            <h4 className="font-medium mb-2">Tips for best results:</h4>
            <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
              <li>Use good lighting to avoid shadows</li>
              <li>Keep the paper flat and aligned</li>
              <li>Upload pages in order (page 1 first, then page 2, etc.)</li>
              <li>Make sure handwriting is clear and legible</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
