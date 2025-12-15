"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, FileText, Pencil, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { formatDate, getScoreColor, getScoreBgColor } from "@/lib/utils";

interface SubmissionDetail {
  id: string;
  imageUrls: string; // JSON array of image URLs
  extractedText: string | null;
  score: number | null;
  maxScore: number | null;
  feedback: string | null;
  status: string;
  createdAt: string;
  gradedAt: string | null;
  // Manual adjustment fields
  originalScore: number | null;
  adjustedBy: string | null;
  adjustmentReason: string | null;
  adjustedAt: string | null;
  student: {
    id: string;
    name: string;
    email: string;
  };
  assessment: {
    id: string;
    title: string;
    markScheme: string;
    markSchemePdfUrl: string | null;
    totalMarks: number;
    class: {
      name: string;
    };
  };
}

export default function SubmissionDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const [submission, setSubmission] = useState<SubmissionDetail | null>(null);
  const [loading, setLoading] = useState(true);

  // Score adjustment state
  const [adjustDialogOpen, setAdjustDialogOpen] = useState(false);
  const [adjustedScore, setAdjustedScore] = useState("");
  const [adjustmentReason, setAdjustmentReason] = useState("");
  const [adjusting, setAdjusting] = useState(false);

  const assessmentId = params.assessmentId as string;
  const submissionId = params.submissionId as string;

  useEffect(() => {
    fetchSubmission();
  }, [submissionId]);

  // Poll for updates if processing
  useEffect(() => {
    let interval: NodeJS.Timeout;

    if (submission?.status === "PROCESSING") {
      interval = setInterval(() => {
        fetchSubmission();
      }, 5000);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [submission?.status, submissionId]);

  const fetchSubmission = async () => {
    try {
      const response = await fetch(`/api/submissions/${submissionId}`);

      if (!response.ok) {
        throw new Error("Submission not found");
      }

      const data = await response.json();
      setSubmission(data.submission);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to load submission",
        variant: "destructive",
      });
      router.push(`/assessments/${assessmentId}`);
    } finally {
      setLoading(false);
    }
  };

  const handleAdjustScore = async () => {
    if (!submission) return;

    const score = parseInt(adjustedScore);
    if (isNaN(score) || score < 0 || score > (submission.maxScore || 0)) {
      toast({
        title: "Invalid Score",
        description: `Score must be between 0 and ${submission.maxScore}`,
        variant: "destructive",
      });
      return;
    }

    if (!adjustmentReason.trim()) {
      toast({
        title: "Reason Required",
        description: "Please provide a reason for the adjustment",
        variant: "destructive",
      });
      return;
    }

    setAdjusting(true);
    try {
      const response = await fetch(`/api/submissions/${submissionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          score,
          reason: adjustmentReason,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to adjust score");
      }

      const data = await response.json();
      setSubmission(data.submission);
      setAdjustDialogOpen(false);
      setAdjustedScore("");
      setAdjustmentReason("");
      toast({
        title: "Score Adjusted",
        description: "The score has been updated successfully",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to adjust score",
        variant: "destructive",
      });
    } finally {
      setAdjusting(false);
    }
  };

  if (loading) {
    return <SubmissionSkeleton />;
  }

  if (!submission) {
    return null;
  }

  const scorePercentage =
    submission.score && submission.maxScore
      ? Math.round((submission.score / submission.maxScore) * 100)
      : 0;

  return (
    <div className="h-[calc(100vh-8rem)] flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-4">
          <Link href={`/assessments/${assessmentId}`}>
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              {submission.student.name}&apos;s Submission
            </h1>
            <p className="text-sm text-muted-foreground">
              {submission.assessment.title} • {submission.assessment.class.name}
            </p>
          </div>
        </div>
        {submission.status === "GRADED" && (
          <div className="flex items-center gap-3">
            <div
              className={`flex items-center gap-4 px-4 py-2 rounded-lg ${getScoreBgColor(
                submission.score || 0,
                submission.assessment.totalMarks
              )}`}
            >
              <div className="flex flex-col">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">Score:</span>
                  <span
                    className={`text-2xl font-bold ${getScoreColor(
                      submission.score || 0,
                      submission.assessment.totalMarks
                    )}`}
                  >
                    {submission.score}/{submission.maxScore}
                  </span>
                  <Badge
                    variant={
                      scorePercentage >= 80
                        ? "success"
                        : scorePercentage >= 60
                          ? "warning"
                          : "destructive"
                    }
                  >
                    {scorePercentage}%
                  </Badge>
                </div>
                {submission.originalScore !== null && submission.originalScore !== submission.score && (
                  <span className="text-xs text-muted-foreground">
                    AI Score: {submission.originalScore}/{submission.maxScore} (adjusted by teacher)
                  </span>
                )}
              </div>
            </div>

            {/* Adjust Score Button */}
            <Dialog open={adjustDialogOpen} onOpenChange={setAdjustDialogOpen}>
              <DialogTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1"
                  onClick={() => setAdjustedScore(String(submission.score || 0))}
                >
                  <Pencil className="h-3 w-3" />
                  Adjust
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Adjust Score</DialogTitle>
                  <DialogDescription>
                    Override the AI-generated score for {submission.student.name}&apos;s submission.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="score">New Score (0 - {submission.maxScore})</Label>
                    <Input
                      id="score"
                      type="number"
                      min={0}
                      max={submission.maxScore || 100}
                      value={adjustedScore}
                      onChange={(e) => setAdjustedScore(e.target.value)}
                      placeholder="Enter new score"
                    />
                    {submission.originalScore !== null && (
                      <p className="text-xs text-muted-foreground">
                        Original AI score: {submission.originalScore}
                      </p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="reason">Reason for Adjustment *</Label>
                    <Textarea
                      id="reason"
                      value={adjustmentReason}
                      onChange={(e) => setAdjustmentReason(e.target.value)}
                      placeholder="Explain why you're adjusting this score..."
                      rows={3}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => setAdjustDialogOpen(false)}
                    disabled={adjusting}
                  >
                    Cancel
                  </Button>
                  <Button onClick={handleAdjustScore} disabled={adjusting}>
                    {adjusting ? "Saving..." : "Save Adjustment"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        )}
      </div>

      {/* Split Screen */}
      <div className="flex-1 flex gap-4 min-h-0">
        {/* Left Panel - Submitted Work + Feedback */}
        <div className="w-1/2 min-w-0 flex flex-col">
          <Card className="flex-1 flex flex-col min-h-0">
            <CardHeader className="py-3">
              <CardTitle className="text-base">Submitted Work & Feedback</CardTitle>
              <CardDescription className="text-xs">
                Student submission with AI-generated feedback
              </CardDescription>
            </CardHeader>
            <CardContent className="flex-1 overflow-auto pb-6">
              <div className="space-y-6">
                {/* Submission Info */}
                <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                  <div>
                    <p className="font-medium">{submission.student.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {submission.student.email}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm">
                      Submitted: {formatDate(submission.createdAt)}
                    </p>
                    {submission.gradedAt && (
                      <p className="text-xs text-muted-foreground">
                        Graded: {formatDate(submission.gradedAt)}
                      </p>
                    )}
                  </div>
                </div>

                {/* Submitted Images */}
                <div>
                  <h3 className="font-medium mb-2">
                    Submitted Work ({JSON.parse(submission.imageUrls).length} page{JSON.parse(submission.imageUrls).length !== 1 ? "s" : ""})
                  </h3>
                  <div className="space-y-4">
                    {JSON.parse(submission.imageUrls).map((url: string, index: number) => (
                      <div key={index} className="border rounded-lg overflow-hidden bg-muted">
                        <div className="bg-muted/80 px-3 py-1 text-sm font-medium border-b">
                          Page {index + 1}
                        </div>
                        <img
                          src={url}
                          alt={`Submitted work page ${index + 1}`}
                          className="w-full"
                        />
                      </div>
                    ))}
                  </div>
                </div>

                {/* Extracted Text */}
                {submission.extractedText && (
                  <div>
                    <h3 className="font-medium mb-2">Extracted Text (OCR)</h3>
                    <div className="p-4 bg-muted/50 rounded-lg font-mono text-sm whitespace-pre-wrap">
                      {submission.extractedText}
                    </div>
                  </div>
                )}

                {/* AI Feedback */}
                {submission.feedback && (
                  <div>
                    <h3 className="font-medium mb-2">AI Feedback</h3>
                    <div className="p-4 bg-primary/5 border border-primary/20 rounded-lg">
                      <div className="markdown-content whitespace-pre-wrap">
                        {submission.feedback}
                      </div>
                    </div>
                  </div>
                )}

                {/* Score Adjustment Notice */}
                {submission.adjustmentReason && (
                  <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-lg">
                    <div className="flex items-start gap-3">
                      <AlertCircle className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" />
                      <div className="space-y-1">
                        <h4 className="font-medium text-amber-800 dark:text-amber-400">
                          Score Adjusted by Teacher
                        </h4>
                        <p className="text-sm">
                          <span className="text-muted-foreground">Original AI Score:</span>{" "}
                          <span className="font-medium">{submission.originalScore}/{submission.maxScore}</span>
                          {" → "}
                          <span className="text-muted-foreground">Adjusted Score:</span>{" "}
                          <span className="font-medium">{submission.score}/{submission.maxScore}</span>
                        </p>
                        <p className="text-sm">
                          <span className="text-muted-foreground">Reason:</span>{" "}
                          {submission.adjustmentReason}
                        </p>
                        {submission.adjustedAt && (
                          <p className="text-xs text-muted-foreground">
                            Adjusted on {formatDate(submission.adjustedAt)}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {submission.status === "PROCESSING" && (
                  <div className="p-6 text-center bg-muted/50 rounded-lg">
                    <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4"></div>
                    <p className="font-medium">Processing submission...</p>
                    <p className="text-sm text-muted-foreground">
                      This may take a moment
                    </p>
                  </div>
                )}

                {submission.status === "ERROR" && (
                  <div className="p-6 text-center bg-destructive/10 rounded-lg">
                    <p className="font-medium text-destructive">
                      Error processing submission
                    </p>
                    <p className="text-sm text-muted-foreground mt-1">
                      {submission.feedback || "An unknown error occurred"}
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Panel - Mark Scheme */}
        <div className="w-1/2 min-w-0 flex flex-col">
          <Card className="flex-1 flex flex-col min-h-0">
            <CardHeader className="py-3">
              <CardTitle className="text-base flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Mark Scheme
              </CardTitle>
              <CardDescription className="text-xs">
                Reference answers and marking criteria
              </CardDescription>
            </CardHeader>
            <CardContent className="flex-1 overflow-auto pb-6">
              <div className="space-y-4">
                {/* PDF View */}
                {submission.assessment.markSchemePdfUrl && (
                  <div>
                    <h3 className="font-medium mb-2">PDF Document</h3>
                    <iframe
                      src={submission.assessment.markSchemePdfUrl}
                      className="w-full h-[500px] rounded-lg border"
                      title="Mark Scheme PDF"
                    />
                  </div>
                )}

                {/* OCR Extracted Text */}
                {submission.assessment.markScheme && (
                  <div>
                    <h3 className="font-medium mb-2">Extracted Text (OCR)</h3>
                    <div className="p-4 bg-muted/50 rounded-lg font-mono text-sm whitespace-pre-wrap max-h-[400px] overflow-auto">
                      {submission.assessment.markScheme}
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function SubmissionSkeleton() {
  return (
    <div className="h-[calc(100vh-8rem)] flex flex-col">
      <div className="flex items-center gap-4 mb-4">
        <Skeleton className="h-10 w-10 rounded" />
        <div>
          <Skeleton className="h-6 w-48 mb-2" />
          <Skeleton className="h-4 w-32" />
        </div>
      </div>
      <div className="flex-1 flex gap-4">
        <Skeleton className="flex-1" />
        <Skeleton className="flex-1" />
      </div>
    </div>
  );
}
