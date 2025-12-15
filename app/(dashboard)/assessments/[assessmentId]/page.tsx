"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import Link from "next/link";
import {
  ArrowLeft,
  Calendar,
  FileText,
  Upload,
  Users,
  Clock,
  CheckCircle2,
  Trash2,
} from "lucide-react";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { formatDate, getScoreColor } from "@/lib/utils";

interface Assessment {
  id: string;
  title: string;
  description: string | null;
  markScheme: string;
  totalMarks: number;
  dueDate: string | null;
  status: string;
  createdAt: string;
  class: {
    id: string;
    name: string;
    teacher: {
      name: string;
    };
  };
  submissions: {
    id: string;
    score: number | null;
    maxScore: number | null;
    status: string;
    createdAt: string;
    student: {
      id: string;
      name: string;
      email: string;
    };
  }[];
}

export default function AssessmentPage() {
  const params = useParams();
  const router = useRouter();
  const { data: session } = useSession();
  const { toast } = useToast();
  const [assessment, setAssessment] = useState<Assessment | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const isTeacher = session?.user?.role === "TEACHER";
  const assessmentId = params.assessmentId as string;

  useEffect(() => {
    fetchAssessment();
  }, [assessmentId]);

  const fetchAssessment = async () => {
    try {
      const response = await fetch(`/api/assessments/${assessmentId}`);

      if (!response.ok) {
        throw new Error("Assessment not found");
      }

      const data = await response.json();
      setAssessment(data.assessment);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to load assessment",
        variant: "destructive",
      });
      router.push("/dashboard");
    } finally {
      setLoading(false);
    }
  };

  const mySubmission = assessment?.submissions.find(
    (s) => s.student.id === session?.user?.id
  );

  const handleDeleteAssessment = async () => {
    setDeleting(true);
    try {
      const response = await fetch(`/api/assessments/${assessmentId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Failed to delete assessment");
      }

      toast({
        title: "Success",
        description: "Assessment deleted successfully",
      });
      router.push(`/classes/${assessment?.class.id}`);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete assessment",
        variant: "destructive",
      });
    } finally {
      setDeleting(false);
      setDeleteDialogOpen(false);
    }
  };

  if (loading) {
    return <AssessmentSkeleton />;
  }

  if (!assessment) {
    return null;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div className="flex items-start gap-4">
          <Link href={`/classes/${assessment.class.id}`}>
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold tracking-tight">
                {assessment.title}
              </h1>
              <Badge
                variant={
                  assessment.status === "ACTIVE"
                    ? "success"
                    : assessment.status === "CLOSED"
                    ? "secondary"
                    : "outline"
                }
              >
                {assessment.status}
              </Badge>
            </div>
            <p className="text-muted-foreground">
              {assessment.class.name}
              {!isTeacher && ` • ${assessment.class.teacher.name}`}
            </p>
          </div>
        </div>

        {isTeacher && assessment.status === "ACTIVE" && (
          <Link href={`/assessments/${assessmentId}/submit`}>
            <Button>
              <Upload className="h-4 w-4 mr-2" />
              Submit Student Work
            </Button>
          </Link>
        )}

        {isTeacher && (
          <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="destructive">
                <Trash2 className="h-4 w-4 mr-2" />
                Delete Assessment
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Delete Assessment</DialogTitle>
                <DialogDescription>
                  Are you sure you want to delete &quot;{assessment.title}&quot;? This will also delete all {assessment.submissions.length} submission(s). This action cannot be undone.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setDeleteDialogOpen(false)}
                  disabled={deleting}
                >
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  onClick={handleDeleteAssessment}
                  disabled={deleting}
                >
                  {deleting ? "Deleting..." : "Delete"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* Assessment Info */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Marks</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{assessment.totalMarks}</div>
          </CardContent>
        </Card>
        {assessment.dueDate && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Due Date</CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-lg font-medium">
                {formatDate(assessment.dueDate)}
              </div>
            </CardContent>
          </Card>
        )}
        {isTeacher && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Submissions</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {assessment.submissions.length}
              </div>
            </CardContent>
          </Card>
        )}
        {isTeacher && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Graded</CardTitle>
              <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {assessment.submissions.filter((s) => s.status === "GRADED").length}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Student View - Show their submission or submit option */}
      {!isTeacher && (
        <Card>
          <CardHeader>
            <CardTitle>Your Submission</CardTitle>
            <CardDescription>
              {mySubmission
                ? "View your submitted work and feedback"
                : "Submit your handwritten work for grading"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {mySubmission ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 rounded-lg border bg-accent/50">
                  <div>
                    <p className="font-medium">Submitted</p>
                    <p className="text-sm text-muted-foreground">
                      {formatDate(mySubmission.createdAt)}
                    </p>
                  </div>
                  <div className="text-right">
                    {mySubmission.status === "GRADED" ? (
                      <div>
                        <span
                          className={`text-2xl font-bold ${getScoreColor(
                            mySubmission.score || 0,
                            assessment.totalMarks
                          )}`}
                        >
                          {mySubmission.score}/{assessment.totalMarks}
                        </span>
                        <p className="text-sm text-muted-foreground">
                          {Math.round(
                            ((mySubmission.score || 0) / assessment.totalMarks) * 100
                          )}
                          %
                        </p>
                      </div>
                    ) : mySubmission.status === "PROCESSING" ? (
                      <Badge variant="warning" className="flex items-center gap-1">
                        <Clock className="h-3 w-3 animate-spin" />
                        Processing
                      </Badge>
                    ) : mySubmission.status === "ERROR" ? (
                      <Badge variant="destructive">Error</Badge>
                    ) : (
                      <Badge variant="secondary">Pending</Badge>
                    )}
                  </div>
                </div>

                {mySubmission.status === "GRADED" && (
                  <Link href={`/assessments/${assessmentId}/feedback`}>
                    <Button className="w-full">
                      View Detailed Feedback
                    </Button>
                  </Link>
                )}
              </div>
            ) : (
              <div className="text-center py-6">
                <Clock className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">
                  Your teacher hasn&apos;t submitted your work for grading yet.
                </p>
                <p className="text-sm text-muted-foreground mt-2">
                  Please wait for your teacher to upload your handwritten work.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Teacher View - Tabs for submissions and mark scheme */}
      {isTeacher && (
        <Tabs defaultValue="submissions" className="space-y-4">
          <TabsList>
            <TabsTrigger value="submissions">
              <Users className="h-4 w-4 mr-2" />
              Submissions
            </TabsTrigger>
            <TabsTrigger value="markscheme">
              <FileText className="h-4 w-4 mr-2" />
              Mark Scheme
            </TabsTrigger>
          </TabsList>

          <TabsContent value="submissions" className="space-y-4">
            {assessment.submissions.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-medium mb-2">
                    No submissions yet
                  </h3>
                  <p className="text-muted-foreground">
                    Students will appear here once they submit their work
                  </p>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardHeader>
                  <CardTitle>Student Submissions</CardTitle>
                  <CardDescription>
                    {assessment.submissions.length} submission(s) received
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="divide-y">
                    {assessment.submissions.map((submission) => (
                      <Link
                        key={submission.id}
                        href={`/assessments/${assessmentId}/submissions/${submission.id}`}
                        className="block"
                      >
                        <div className="flex items-center justify-between py-4 hover:bg-accent/50 px-2 -mx-2 rounded transition-colors">
                          <div>
                            <p className="font-medium">{submission.student.name}</p>
                            <p className="text-sm text-muted-foreground">
                              {submission.student.email}
                            </p>
                            <p className="text-xs text-muted-foreground mt-1">
                              Submitted {formatDate(submission.createdAt)}
                            </p>
                          </div>
                          <div className="text-right">
                            {submission.status === "GRADED" ? (
                              <span
                                className={`text-lg font-bold ${getScoreColor(
                                  submission.score || 0,
                                  assessment.totalMarks
                                )}`}
                              >
                                {submission.score}/{assessment.totalMarks}
                              </span>
                            ) : submission.status === "PROCESSING" ? (
                              <Badge variant="warning">Processing</Badge>
                            ) : submission.status === "ERROR" ? (
                              <Badge variant="destructive">Error</Badge>
                            ) : (
                              <Badge variant="secondary">Pending</Badge>
                            )}
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="markscheme">
            <Card>
              <CardHeader>
                <CardTitle>Mark Scheme</CardTitle>
                <CardDescription>
                  This is used by the AI to grade student submissions
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="bg-muted/50 rounded-lg p-4 font-mono text-sm whitespace-pre-wrap">
                  {assessment.markScheme}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}

function AssessmentSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-start gap-4">
        <Skeleton className="h-10 w-10 rounded" />
        <div>
          <Skeleton className="h-8 w-64 mb-2" />
          <Skeleton className="h-4 w-48" />
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <Card key={i}>
            <CardHeader>
              <Skeleton className="h-4 w-24" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-16" />
            </CardContent>
          </Card>
        ))}
      </div>
      <Skeleton className="h-64 w-full" />
    </div>
  );
}
