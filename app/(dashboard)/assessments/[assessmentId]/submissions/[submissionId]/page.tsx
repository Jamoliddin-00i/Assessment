"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, FileText, Pencil, AlertCircle, RefreshCw, User, FileImage, MessageSquare, BookOpen, LayoutDashboard, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
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
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from "@/components/ui/resizable-panel";

interface SubmissionDetail {
  id: string;
  imageUrls: string;
  extractedText: string | null;
  score: number | null;
  maxScore: number | null;
  feedback: string | null;
  status: string;
  createdAt: string;
  gradedAt: string | null;
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
    markSchemeFileUrls: string | null;
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

  const [adjustDialogOpen, setAdjustDialogOpen] = useState(false);
  const [adjustedScore, setAdjustedScore] = useState("");
  const [adjustmentReason, setAdjustmentReason] = useState("");
  const [adjusting, setAdjusting] = useState(false);

  const assessmentId = params.assessmentId as string;
  const submissionId = params.submissionId as string;

  const fetchSubmission = useCallback(async () => {
    try {
      const response = await fetch(`/api/submissions/${submissionId}`);
      if (!response.ok) throw new Error("Submission not found");
      const data = await response.json();
      setSubmission(data.submission);
    } catch {
      toast({
        title: "Error",
        description: "Failed to load submission",
        variant: "destructive",
      });
      router.push(`/assessments/${assessmentId}`);
    } finally {
      setLoading(false);
    }
  }, [submissionId, assessmentId, toast, router]);

  useEffect(() => {
    fetchSubmission();
  }, [fetchSubmission]);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (submission?.status === "PROCESSING") {
      interval = setInterval(() => fetchSubmission(), 5000);
    }
    return () => { if (interval) clearInterval(interval); };
  }, [submission?.status, fetchSubmission]);

  const handleAdjustScore = async () => {
    if (!submission) return;
    const score = parseInt(adjustedScore);
    if (isNaN(score) || score < 0 || score > (submission.maxScore || 0)) {
      toast({ title: "Invalid Score", description: `Score must be between 0 and ${submission.maxScore}`, variant: "destructive" });
      return;
    }
    if (!adjustmentReason.trim()) {
      toast({ title: "Reason Required", description: "Please provide a reason for the adjustment", variant: "destructive" });
      return;
    }

    setAdjusting(true);
    try {
      const response = await fetch(`/api/submissions/${submissionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ score, reason: adjustmentReason }),
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
      toast({ title: "Score Adjusted", description: "The score has been updated successfully" });
    } catch (error) {
      toast({ title: "Error", description: error instanceof Error ? error.message : "Failed to adjust score", variant: "destructive" });
    } finally {
      setAdjusting(false);
    }
  };

  const [headerVisible, setHeaderVisible] = useState(false);
  const headerRef = useRef<HTMLDivElement>(null);

  if (loading) return <SubmissionSkeleton />;
  if (!submission) return null;

  const scorePercentage = submission.score && submission.maxScore
    ? Math.round((submission.score / submission.maxScore) * 100) : 0;

  const imageUrls = JSON.parse(submission.imageUrls || "[]");
  const markSchemeUrls = submission.assessment.markSchemeFileUrls
    ? JSON.parse(submission.assessment.markSchemeFileUrls)
    : (submission.assessment.markSchemePdfUrl ? [submission.assessment.markSchemePdfUrl] : []);

  return (
    <div className="fixed inset-0 z-40 bg-background flex flex-col">
      {/* Hover trigger zone at top */}
      <div
        className="fixed top-0 left-0 right-0 h-3 z-50"
        onMouseEnter={() => setHeaderVisible(true)}
      />

      {/* Auto-hiding minimal header */}
      <div
        ref={headerRef}
        className={`fixed top-0 left-0 right-0 z-50 transition-transform duration-300 ease-out ${headerVisible ? 'translate-y-0' : '-translate-y-full'}`}
        onMouseEnter={() => setHeaderVisible(true)}
        onMouseLeave={() => setHeaderVisible(false)}
      >
        <div className="flex items-center justify-center gap-1 px-2 py-1.5 bg-background/90 backdrop-blur-md border-b shadow-sm">
          {/* Left: Back */}
          <Link href={`/assessments/${assessmentId}`}>
            <Button variant="ghost" size="icon" className="h-8 w-8" title="Back to Assessment">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>

          <div className="h-4 w-px bg-border mx-1" />

          {/* Center: Navigation icons */}
          <Link href="/dashboard">
            <Button variant="ghost" size="icon" className="h-8 w-8" title="Dashboard">
              <LayoutDashboard className="h-4 w-4" />
            </Button>
          </Link>
          <Link href="/classes">
            <Button variant="ghost" size="icon" className="h-8 w-8" title="Classes">
              <Users className="h-4 w-4" />
            </Button>
          </Link>

          <div className="h-4 w-px bg-border mx-1" />

          {/* Status & Score */}
          {submission.status === "PROCESSING" && (
            <Badge variant="warning" className="gap-1 h-6 text-xs">
              <div className="h-1.5 w-1.5 rounded-full bg-current animate-pulse" />
              Processing
            </Badge>
          )}
          {submission.status === "ERROR" && (
            <Badge variant="destructive" className="h-6 text-xs">Error</Badge>
          )}

          {submission.status === "GRADED" && (
            <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded ${getScoreBgColor(submission.score || 0, submission.maxScore || 100)}`}>
              <span className={`text-sm font-bold ${getScoreColor(submission.score || 0, submission.maxScore || 100)}`}>
                {submission.score}/{submission.maxScore}
              </span>
              <Badge variant={scorePercentage >= 80 ? "success" : scorePercentage >= 60 ? "warning" : "destructive"} className="h-5 text-xs px-1.5">
                {scorePercentage}%
              </Badge>
            </div>
          )}

          <div className="h-4 w-px bg-border mx-1" />

          {/* Actions */}
          {(submission.status === "GRADED" || submission.status === "ERROR") && (
            <Link href={`/assessments/${assessmentId}/submit?resubmit=${submissionId}`}>
              <Button variant="ghost" size="icon" className="h-8 w-8" title="Resubmit">
                <RefreshCw className="h-4 w-4" />
              </Button>
            </Link>
          )}

          {submission.status === "GRADED" && (
            <Dialog open={adjustDialogOpen} onOpenChange={setAdjustDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8" title="Adjust Score" onClick={() => setAdjustedScore(String(submission.score || 0))}>
                  <Pencil className="h-4 w-4" />
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Adjust Score</DialogTitle>
                  <DialogDescription>Override the AI-generated score for {submission.student.name}.</DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="score">New Score (0 - {submission.maxScore})</Label>
                    <Input id="score" type="number" min={0} max={submission.maxScore || 100} value={adjustedScore} onChange={(e) => setAdjustedScore(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="reason">Reason *</Label>
                    <Textarea id="reason" value={adjustmentReason} onChange={(e) => setAdjustmentReason(e.target.value)} placeholder="Explain why..." rows={3} />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setAdjustDialogOpen(false)} disabled={adjusting}>Cancel</Button>
                  <Button onClick={handleAdjustScore} disabled={adjusting}>{adjusting ? "Saving..." : "Save"}</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>

      {/* 3-Panel Split View */}
      <ResizablePanelGroup direction="horizontal" className="flex-1 min-h-0">
        {/* Panel 1: Student Paperwork */}
        <ResizablePanel defaultSize={35} minSize={20} maxSize={50}>
          <div className="h-full flex flex-col bg-muted/30">
            <div className="flex items-center gap-2 px-3 py-2 border-b bg-background/50">
              <FileImage className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium">Student Work</span>
              <Badge variant="secondary" className="ml-auto text-xs">{imageUrls.length} page{imageUrls.length !== 1 ? "s" : ""}</Badge>
            </div>
            <div className="flex-1 overflow-auto p-2">
              <div className="space-y-2">
                {imageUrls.map((url: string, index: number) => (
                  <div key={index} className="rounded-lg overflow-hidden border bg-background shadow-sm">
                    <div className="bg-muted px-2 py-1 text-xs font-medium border-b">Page {index + 1}</div>
                    <img src={url} alt={`Page ${index + 1}`} className="w-full" />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </ResizablePanel>

        <ResizableHandle withHandle />

        {/* Panel 2: OCR + Feedback */}
        <ResizablePanel defaultSize={35} minSize={20} maxSize={50}>
          <div className="h-full flex flex-col bg-muted/20">
            <div className="flex items-center gap-2 px-3 py-2 border-b bg-background/50">
              <MessageSquare className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium">OCR & Feedback</span>
            </div>
            <div className="flex-1 overflow-auto p-3">
              <div className="space-y-4">
                {/* Student Info */}
                <div className="flex items-center gap-3 p-2 bg-background rounded-lg border">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{submission.student.name}</p>
                    <p className="text-xs text-muted-foreground truncate">{submission.student.email}</p>
                  </div>
                  <div className="text-right text-xs text-muted-foreground">
                    <p>{formatDate(submission.createdAt)}</p>
                  </div>
                </div>

                {/* Extracted Text */}
                {submission.extractedText && (
                  <div>
                    <h3 className="text-sm font-medium mb-2 flex items-center gap-2">
                      <FileText className="h-4 w-4" />
                      Extracted Text (OCR)
                    </h3>
                    <div className="p-3 bg-background rounded-lg border font-mono text-xs whitespace-pre-wrap max-h-[300px] overflow-auto">
                      {submission.extractedText}
                    </div>
                  </div>
                )}

                {/* AI Feedback */}
                {submission.feedback && submission.status === "GRADED" && (
                  <div>
                    <h3 className="text-sm font-medium mb-2 flex items-center gap-2">
                      <MessageSquare className="h-4 w-4" />
                      AI Feedback
                    </h3>
                    <div className="p-3 bg-primary/5 border border-primary/20 rounded-lg">
                      <div className="markdown-content text-sm whitespace-pre-wrap">
                        {submission.feedback}
                      </div>
                    </div>
                  </div>
                )}

                {/* Score Adjustment */}
                {submission.adjustmentReason && (
                  <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg">
                    <div className="flex items-start gap-2">
                      <AlertCircle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
                      <div className="space-y-1 text-sm">
                        <p className="font-medium text-amber-800 dark:text-amber-400">Score Adjusted</p>
                        <p className="text-xs">
                          {submission.originalScore}/{submission.maxScore} → {submission.score}/{submission.maxScore}
                        </p>
                        <p className="text-xs text-muted-foreground">{submission.adjustmentReason}</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Processing State */}
                {submission.status === "PROCESSING" && (
                  <div className="p-6 text-center bg-background rounded-lg border">
                    <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full mx-auto mb-2" />
                    <p className="text-sm font-medium">Processing...</p>
                  </div>
                )}

                {/* Error State */}
                {submission.status === "ERROR" && (
                  <div className="p-4 text-center bg-destructive/10 rounded-lg border border-destructive/20">
                    <p className="text-sm font-medium text-destructive">Error processing</p>
                    <p className="text-xs text-muted-foreground mt-1">{submission.feedback}</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </ResizablePanel>

        <ResizableHandle withHandle />

        {/* Panel 3: Mark Scheme */}
        <ResizablePanel defaultSize={30} minSize={20} maxSize={50}>
          <div className="h-full flex flex-col bg-muted/10">
            <div className="flex items-center gap-2 px-3 py-2 border-b bg-background/50">
              <BookOpen className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium">Mark Scheme</span>
            </div>
            <div className="flex-1 overflow-auto p-3">
              <div className="space-y-4">
                {/* Mark Scheme Files */}
                {markSchemeUrls.length > 0 && (
                  <div>
                    <h3 className="text-sm font-medium mb-2">Documents</h3>
                    <div className="space-y-2">
                      {markSchemeUrls.map((url: string, index: number) => {
                        const isPdf = url.toLowerCase().endsWith('.pdf');
                        return (
                          <div key={index} className="rounded-lg overflow-hidden border bg-background">
                            {isPdf ? (
                              <iframe src={url} className="w-full h-[400px]" title={`Mark Scheme ${index + 1}`} />
                            ) : (
                              <img src={url} alt={`Mark Scheme ${index + 1}`} className="w-full" />
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* OCR Text */}
                {submission.assessment.markScheme && (
                  <div>
                    <h3 className="text-sm font-medium mb-2 flex items-center gap-2">
                      <FileText className="h-4 w-4" />
                      Extracted Text (OCR)
                    </h3>
                    <div className="p-3 bg-background rounded-lg border font-mono text-xs whitespace-pre-wrap max-h-[400px] overflow-auto">
                      {submission.assessment.markScheme}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
}

function SubmissionSkeleton() {
  return (
    <div className="fixed inset-0 z-40 bg-background flex flex-col">
      <div className="flex items-center gap-4 px-4 py-3 border-b">
        <Skeleton className="h-8 w-20" />
        <Skeleton className="h-6 w-48" />
      </div>
      <div className="flex-1 flex">
        <Skeleton className="flex-1" />
        <Skeleton className="flex-1" />
        <Skeleton className="flex-1" />
      </div>
    </div>
  );
}
