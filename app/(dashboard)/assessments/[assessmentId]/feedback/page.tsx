"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, FileText, Maximize2, Minimize2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { getScoreColor, getScoreBgColor } from "@/lib/utils";

interface SubmissionData {
  id: string;
  imageUrls: string; // JSON array of image URLs
  extractedText: string | null;
  score: number | null;
  maxScore: number | null;
  feedback: string | null;
  status: string;
  // Manual adjustment fields
  originalScore: number | null;
  adjustmentReason: string | null;
  adjustedAt: string | null;
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

export default function FeedbackPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const [submission, setSubmission] = useState<SubmissionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [leftPanelExpanded, setLeftPanelExpanded] = useState(false);

  const assessmentId = params.assessmentId as string;

  useEffect(() => {
    fetchSubmission();
  }, [assessmentId]);

  const fetchSubmission = async () => {
    try {
      const response = await fetch(`/api/assessments/${assessmentId}/my-submission`);

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

  if (loading) {
    return <FeedbackSkeleton />;
  }

  if (!submission) {
    return null;
  }

  const scorePercentage = submission.score && submission.maxScore
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
              {submission.assessment.title}
            </h1>
            <p className="text-sm text-muted-foreground">
              {submission.assessment.class.name}
            </p>
          </div>
        </div>
        <div
          className={`flex items-center gap-4 px-4 py-2 rounded-lg ${getScoreBgColor(
            submission.score || 0,
            submission.assessment.totalMarks
          )}`}
        >
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">Your Score:</span>
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
                Adjusted by teacher (AI: {submission.originalScore}/{submission.maxScore})
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Split Screen */}
      <div className="flex-1 flex gap-4 min-h-0">
        {/* Left Panel - Your Work + Feedback */}
        <div
          className={`flex flex-col min-w-0 transition-all duration-300 ${
            leftPanelExpanded ? "w-2/3" : "w-1/2"
          }`}
        >
          <Card className="flex-1 flex flex-col min-h-0">
            <CardHeader className="flex flex-row items-center justify-between py-3">
              <div>
                <CardTitle className="text-base">Your Work & Feedback</CardTitle>
                <CardDescription className="text-xs">
                  Your submission with AI feedback
                </CardDescription>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setLeftPanelExpanded(!leftPanelExpanded)}
              >
                {leftPanelExpanded ? (
                  <Minimize2 className="h-4 w-4" />
                ) : (
                  <Maximize2 className="h-4 w-4" />
                )}
              </Button>
            </CardHeader>
            <CardContent className="flex-1 overflow-auto pb-6">
              <div className="space-y-6">
                {/* Submitted Images */}
                <div>
                  <h3 className="font-medium mb-2">
                    Your Submitted Work ({JSON.parse(submission.imageUrls).length} page{JSON.parse(submission.imageUrls).length !== 1 ? "s" : ""})
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
                    <h3 className="font-medium mb-2">
                      Extracted Text (OCR)
                    </h3>
                    <div className="p-4 bg-muted/50 rounded-lg font-mono text-sm whitespace-pre-wrap">
                      {submission.extractedText}
                    </div>
                  </div>
                )}

                {/* AI Feedback */}
                {submission.feedback && (
                  <div>
                    <h3 className="font-medium mb-2">AI Feedback</h3>
                    <div className="p-4 bg-primary/5 border border-primary/20 rounded-lg prose prose-sm max-w-none dark:prose-invert">
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
                          Your score was adjusted from{" "}
                          <span className="font-medium">{submission.originalScore}/{submission.maxScore}</span>
                          {" to "}
                          <span className="font-medium">{submission.score}/{submission.maxScore}</span>
                        </p>
                        <p className="text-sm">
                          <span className="text-muted-foreground">Reason:</span>{" "}
                          {submission.adjustmentReason}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Panel - Mark Scheme */}
        <div
          className={`flex flex-col min-w-0 transition-all duration-300 ${
            leftPanelExpanded ? "w-1/3" : "w-1/2"
          }`}
        >
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

function FeedbackSkeleton() {
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
