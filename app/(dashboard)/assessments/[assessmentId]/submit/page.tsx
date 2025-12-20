"use client";

import { useState, useCallback, useEffect } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { useDropzone } from "react-dropzone";
import { ArrowLeft, Upload, X, Loader2, User, RefreshCw } from "lucide-react";
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
import { playGlobalSound } from "@/hooks/use-sound-effects";

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

interface ExistingSubmission {
  id: string;
  imageUrls: string;
  studentId: string;
  student: {
    id: string;
    name: string;
  };
}

export default function SubmitAssessmentPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session } = useSession();
  const { toast } = useToast();
  const [uploading, setUploading] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [selectedStudentId, setSelectedStudentId] = useState<string>("");
  const [assessment, setAssessment] = useState<Assessment | null>(null);
  const [loading, setLoading] = useState(true);

  // Resubmit state
  const [, setExistingSubmission] = useState<ExistingSubmission | null>(null);
  const [previousImageUrls, setPreviousImageUrls] = useState<string[]>([]);
  const [usePreviousImages, setUsePreviousImages] = useState(false);

  const assessmentId = params.assessmentId as string;
  const resubmitId = searchParams.get("resubmit");
  const isTeacher = session?.user?.role === "TEACHER";
  const isResubmit = !!resubmitId;

  const fetchAssessment = useCallback(async () => {
    try {
      const response = await fetch(`/api/assessments/${assessmentId}`);
      if (!response.ok) throw new Error("Failed to fetch assessment");
      const data = await response.json();
      setAssessment(data.assessment);
    } catch {
      toast({
        title: "Error",
        description: "Failed to load assessment details",
        variant: "destructive",
      });
      router.push("/dashboard");
    } finally {
      setLoading(false);
    }
  }, [assessmentId, toast, router]);

  const fetchExistingSubmission = useCallback(async (submissionId: string) => {
    try {
      const response = await fetch(`/api/submissions/${submissionId}`);
      if (!response.ok) throw new Error("Failed to fetch submission");
      const data = await response.json();
      const submission = data.submission;

      setExistingSubmission(submission);
      setSelectedStudentId(submission.student.id);

      // Parse and set previous image URLs
      const imageUrls = JSON.parse(submission.imageUrls) as string[];
      setPreviousImageUrls(imageUrls);
      setUsePreviousImages(true);

      toast({
        title: "Resubmitting",
        description: `Loaded previous submission for ${submission.student.name}. You can keep the same images or upload new ones.`,
      });
    } catch {
      toast({
        title: "Error",
        description: "Failed to load existing submission",
        variant: "destructive",
      });
    }
  }, [toast]);

  useEffect(() => {
    fetchAssessment();
    if (resubmitId) {
      fetchExistingSubmission(resubmitId);
    }
  }, [fetchAssessment, fetchExistingSubmission, resubmitId]);

  // Get students who haven't submitted yet
  const studentsWithoutSubmission = assessment?.class.enrollments.filter(
    (enrollment) =>
      !assessment.submissions.some((sub) => sub.studentId === enrollment.student.id)
  ) || [];

  // Get all students for selection (including those who already submitted - for re-submission)
  const allStudents = assessment?.class.enrollments.map((e) => e.student) || [];

  const onDrop = useCallback((acceptedFiles: File[]) => {
    // When new files are added, disable using previous images
    if (acceptedFiles.length > 0 && usePreviousImages) {
      setUsePreviousImages(false);
    }

    const newFiles = [...selectedFiles, ...acceptedFiles];
    setSelectedFiles(newFiles);

    // Play upload sound when files are added
    if (acceptedFiles.length > 0) {
      playGlobalSound("upload");
    }

    // Create previews for new files
    acceptedFiles.forEach((file) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreviews((prev) => [...prev, reader.result as string]);
      };
      reader.readAsDataURL(file);
    });
  }, [selectedFiles, usePreviousImages]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "image/*": [".png", ".jpg", ".jpeg", ".gif", ".webp"],
    },
    maxSize: 10 * 1024 * 1024, // 10MB per file
  });

  const removeFile = (index: number) => {
    playGlobalSound("delete");
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
    setPreviews((prev) => prev.filter((_, i) => i !== index));
  };

  const clearAllFiles = () => {
    if (selectedFiles.length > 0 || usePreviousImages) {
      playGlobalSound("delete");
    }
    setSelectedFiles([]);
    setPreviews([]);
    setUsePreviousImages(false);
  };

  const restorePreviousImages = () => {
    if (previousImageUrls.length > 0) {
      setSelectedFiles([]);
      setPreviews([]);
      setUsePreviousImages(true);
      playGlobalSound("upload");
      toast({
        title: "Restored",
        description: "Previous images have been restored",
      });
    }
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

    // Check if we have files (new uploads) or using previous images
    const hasNewFiles = selectedFiles.length > 0;
    const usingPrevious = usePreviousImages && previousImageUrls.length > 0;

    if (!hasNewFiles && !usingPrevious) {
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
      formData.append("assessmentId", assessmentId);
      formData.append("studentId", selectedStudentId);

      if (hasNewFiles) {
        // Upload new files
        selectedFiles.forEach((file) => {
          formData.append("files", file);
        });
      } else if (usingPrevious) {
        // Resubmit with previous images
        formData.append("reuseImageUrls", JSON.stringify(previousImageUrls));
      }

      const response = await fetch("/api/submissions/upload", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to upload submission");
      }

      // Play submit sound for successful upload
      playGlobalSound("submit");

      toast({
        title: isResubmit ? "Resubmission successful!" : "Submission uploaded!",
        description: "The work is being processed and graded. This may take a moment.",
        variant: "success",
      });

      // Clear form and refresh (without sound since we just submitted)
      setSelectedFiles([]);
      setPreviews([]);
      setSelectedStudentId("");
      setUsePreviousImages(false);
      setPreviousImageUrls([]);
      setExistingSubmission(null);
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
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            {isResubmit && <RefreshCw className="h-6 w-6" />}
            {isResubmit ? "Resubmit Student Work" : "Submit Student Work"}
          </h1>
          <p className="text-muted-foreground">
            {assessment?.title} - {isResubmit ? "Resubmit with same or new images" : "Upload student's handwritten work for grading"}
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

          {/* Previous Images (resubmit mode) */}
          {usePreviousImages && previousImageUrls.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="font-medium flex items-center gap-2">
                  <RefreshCw className="h-4 w-4" />
                  Previous Images ({previousImageUrls.length})
                </h4>
                <Button variant="outline" size="sm" onClick={clearAllFiles}>
                  Clear & Upload New
                </Button>
              </div>
              <div className="p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg text-sm text-blue-700 dark:text-blue-300">
                These are the images from the previous submission. Click &quot;Submit&quot; to reprocess with the same images, or &quot;Clear &amp; Upload New&quot; to upload different images.
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {previousImageUrls.map((url, index) => (
                  <div key={index} className="relative group">
                    <img
                      src={url}
                      alt={`Previous submission page ${index + 1}`}
                      className="w-full aspect-[3/4] object-cover rounded-lg border"
                    />
                    <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-xs p-2 rounded-b-lg truncate">
                      Page {index + 1} (previous)
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* New Files */}
          {selectedFiles.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="font-medium">
                  {isResubmit ? "New Images" : "Selected Files"} ({selectedFiles.length})
                </h4>
                <div className="flex gap-2">
                  {isResubmit && previousImageUrls.length > 0 && !usePreviousImages && (
                    <Button variant="outline" size="sm" onClick={restorePreviousImages}>
                      Use Previous
                    </Button>
                  )}
                  <Button variant="outline" size="sm" onClick={clearAllFiles}>
                    Clear All
                  </Button>
                </div>
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

          {/* Restore previous images button when cleared */}
          {isResubmit && previousImageUrls.length > 0 && !usePreviousImages && selectedFiles.length === 0 && (
            <div className="p-4 bg-muted/50 rounded-lg text-center">
              <p className="text-sm text-muted-foreground mb-2">
                You cleared the previous images. Upload new ones or restore the previous.
              </p>
              <Button variant="outline" size="sm" onClick={restorePreviousImages}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Restore Previous Images
              </Button>
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
              disabled={!selectedStudentId || (selectedFiles.length === 0 && !usePreviousImages) || uploading}
              className="flex-1"
            >
              {uploading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  {isResubmit ? "Resubmitting..." : "Uploading & Processing..."}
                </>
              ) : usePreviousImages ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Resubmit with Previous Images ({previousImageUrls.length})
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-2" />
                  {isResubmit ? "Resubmit" : "Submit"} Work ({selectedFiles.length} image{selectedFiles.length !== 1 ? "s" : ""})
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
