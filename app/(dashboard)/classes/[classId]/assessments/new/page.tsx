"use client";

import { useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, FileText, Upload, X, File, Image, FileSpreadsheet } from "lucide-react";
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
import { playGlobalSound } from "@/hooks/use-sound-effects";

// Supported file types for mark schemes
const SUPPORTED_TYPES = {
  "application/pdf": { ext: ".pdf", icon: FileText, label: "PDF" },
  "image/png": { ext: ".png", icon: Image, label: "Image" },
  "image/jpeg": { ext: ".jpg", icon: Image, label: "Image" },
  "image/jpg": { ext: ".jpg", icon: Image, label: "Image" },
  "image/gif": { ext: ".gif", icon: Image, label: "Image" },
  "image/webp": { ext: ".webp", icon: Image, label: "Image" },
  "application/msword": { ext: ".doc", icon: File, label: "Word" },
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": { ext: ".docx", icon: File, label: "Word" },
  "application/vnd.ms-excel": { ext: ".xls", icon: FileSpreadsheet, label: "Excel" },
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": { ext: ".xlsx", icon: FileSpreadsheet, label: "Excel" },
};

const ACCEPT_STRING = Object.entries(SUPPORTED_TYPES)
  .map(([mime, { ext }]) => `${mime},${ext}`)
  .join(",");

function getFileIcon(type: string) {
  const config = SUPPORTED_TYPES[type as keyof typeof SUPPORTED_TYPES];
  return config?.icon || FileText;
}

function getFileLabel(type: string) {
  const config = SUPPORTED_TYPES[type as keyof typeof SUPPORTED_TYPES];
  return config?.label || "File";
}

function isSupportedType(type: string) {
  return type in SUPPORTED_TYPES;
}

export default function NewAssessmentPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const classId = params.classId as string;
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [title, setTitle] = useState("");
  const [totalMarks, setTotalMarks] = useState("");
  const [markSchemeFiles, setMarkSchemeFiles] = useState<File[]>([]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      const newFiles: File[] = [];
      const invalidFiles: string[] = [];

      Array.from(files).forEach((file) => {
        if (isSupportedType(file.type)) {
          newFiles.push(file);
        } else {
          invalidFiles.push(file.name);
        }
      });

      if (invalidFiles.length > 0) {
        toast({
          title: "Some files not supported",
          description: `Unsupported files: ${invalidFiles.join(", ")}. Supported formats: PDF, Word, Excel, and images.`,
          variant: "destructive",
        });
      }

      if (newFiles.length > 0) {
        playGlobalSound("upload");
        setMarkSchemeFiles((prev) => [...prev, ...newFiles]);
      }

      // Reset input to allow selecting the same files again
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleRemoveFile = (index: number) => {
    playGlobalSound("delete");
    setMarkSchemeFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleClearAll = () => {
    if (markSchemeFiles.length > 0) {
      playGlobalSound("delete");
    }
    setMarkSchemeFiles([]);
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

    if (markSchemeFiles.length === 0) {
      toast({
        title: "Mark scheme required",
        description: "Please upload at least one mark scheme file (PDF, Word, Excel, or image).",
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
    playGlobalSound("submit");

    try {
      const formData = new FormData();
      formData.append("title", title);
      formData.append("totalMarks", totalMarks);

      // Append all mark scheme files
      markSchemeFiles.forEach((file) => {
        formData.append("markSchemeFiles", file);
      });

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
            Upload mark scheme files. The AI will extract the grading criteria
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
              <Label>Mark Scheme Files *</Label>
              <p className="text-sm text-muted-foreground">
                Upload files containing the mark scheme. You can upload multiple files
                of different types. The AI will extract and combine the grading criteria.
              </p>

              <input
                ref={fileInputRef}
                type="file"
                accept={ACCEPT_STRING}
                onChange={handleFileSelect}
                className="hidden"
                id="markSchemeFiles"
                multiple
              />

              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed rounded-lg p-6 text-center cursor-pointer hover:border-primary hover:bg-accent/50 transition-colors"
              >
                <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-3" />
                <p className="text-sm font-medium">Click to upload mark scheme files</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Supported: PDF, Word (.doc, .docx), Excel (.xls, .xlsx), Images
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  You can select multiple files at once
                </p>
              </div>

              {markSchemeFiles.length > 0 && (
                <div className="space-y-2 mt-4">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium">
                      Selected Files ({markSchemeFiles.length})
                    </p>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={handleClearAll}
                    >
                      Clear All
                    </Button>
                  </div>
                  <div className="space-y-2">
                    {markSchemeFiles.map((file, index) => {
                      const FileIcon = getFileIcon(file.type);
                      const fileLabel = getFileLabel(file.type);
                      return (
                        <div
                          key={`${file.name}-${index}`}
                          className="border rounded-lg p-3 flex items-center justify-between bg-accent/30"
                        >
                          <div className="flex items-center gap-3">
                            <FileIcon className="h-6 w-6 text-primary" />
                            <div>
                              <p className="font-medium text-sm truncate max-w-[200px]">
                                {file.name}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {fileLabel} • {(file.size / 1024).toFixed(1)} KB
                              </p>
                            </div>
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => handleRemoveFile(index)}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      );
                    })}
                  </div>
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
