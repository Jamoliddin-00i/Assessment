"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  BookOpen,
  FileText,
  Plus,
  Trophy,
  TrendingUp,
  Clock,
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
import { useToast } from "@/hooks/use-toast";
import { formatDate, getScoreColor } from "@/lib/utils";

interface EnrolledClass {
  id: string;
  class: {
    id: string;
    name: string;
    code: string;
    subject: string | null;
    teacher: {
      name: string;
    };
    _count: {
      assessments: number;
    };
  };
}

interface RecentAssessment {
  id: string;
  title: string;
  totalMarks: number;
  dueDate: string | null;
  status: string;
  class: {
    name: string;
  };
  submissions: {
    id: string;
    score: number | null;
    status: string;
  }[];
}

interface DashboardStats {
  totalClasses: number;
  completedAssessments: number;
  averageScore: number;
  pendingAssessments: number;
}

export function StudentDashboard() {
  const { toast } = useToast();
  const [enrolledClasses, setEnrolledClasses] = useState<EnrolledClass[]>([]);
  const [recentAssessments, setRecentAssessments] = useState<RecentAssessment[]>([]);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [joinDialogOpen, setJoinDialogOpen] = useState(false);
  const [classCode, setClassCode] = useState("");
  const [joining, setJoining] = useState(false);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      const [classesRes, assessmentsRes, statsRes] = await Promise.all([
        fetch("/api/student/classes"),
        fetch("/api/student/assessments/recent?limit=5"),
        fetch("/api/student/dashboard/stats"),
      ]);

      if (classesRes.ok) {
        const data = await classesRes.json();
        setEnrolledClasses(data.enrollments || []);
      }

      if (assessmentsRes.ok) {
        const data = await assessmentsRes.json();
        setRecentAssessments(data.assessments || []);
      }

      if (statsRes.ok) {
        const data = await statsRes.json();
        setStats(data);
      }
    } catch (error) {
      console.error("Error fetching dashboard data:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleJoinClass = async () => {
    if (!classCode.trim()) {
      toast({
        title: "Enter a class code",
        description: "Please enter the class code provided by your teacher.",
        variant: "destructive",
      });
      return;
    }

    setJoining(true);

    try {
      const response = await fetch("/api/classes/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: classCode.toUpperCase() }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to join class");
      }

      toast({
        title: "Joined successfully!",
        description: `You have joined ${data.class.name}`,
        variant: "success",
      });

      setJoinDialogOpen(false);
      setClassCode("");
      fetchDashboardData();
    } catch (error) {
      toast({
        title: "Failed to join class",
        description: error instanceof Error ? error.message : "Something went wrong",
        variant: "destructive",
      });
    } finally {
      setJoining(false);
    }
  };

  if (loading) {
    return <DashboardSkeleton />;
  }

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Enrolled Classes</CardTitle>
            <BookOpen className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.totalClasses || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completed</CardTitle>
            <Trophy className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.completedAssessments || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Average Score</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats?.averageScore ? `${stats.averageScore.toFixed(1)}%` : "N/A"}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.pendingAssessments || 0}</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Enrolled Classes */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>My Classes</CardTitle>
              <CardDescription>Classes you are enrolled in</CardDescription>
            </div>
            <Dialog open={joinDialogOpen} onOpenChange={setJoinDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <Plus className="h-4 w-4 mr-1" />
                  Join Class
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Join a Class</DialogTitle>
                  <DialogDescription>
                    Enter the class code provided by your teacher to join a class.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="classCode">Class Code</Label>
                    <Input
                      id="classCode"
                      placeholder="e.g., ABC123"
                      value={classCode}
                      onChange={(e) => setClassCode(e.target.value.toUpperCase())}
                      maxLength={6}
                      className="text-center text-2xl tracking-widest font-mono"
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => setJoinDialogOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button onClick={handleJoinClass} loading={joining}>
                    Join Class
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </CardHeader>
          <CardContent>
            {enrolledClasses.length === 0 ? (
              <div className="text-center py-8">
                <BookOpen className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
                <p className="text-muted-foreground">No classes yet</p>
                <Button
                  variant="outline"
                  className="mt-3"
                  onClick={() => setJoinDialogOpen(true)}
                >
                  Join Your First Class
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                {enrolledClasses.map((enrollment) => (
                  <Link
                    key={enrollment.id}
                    href={`/classes/${enrollment.class.id}`}
                    className="block"
                  >
                    <div className="flex items-center justify-between p-4 rounded-lg border hover:bg-accent/50 transition-colors">
                      <div>
                        <h4 className="font-medium">{enrollment.class.name}</h4>
                        <p className="text-sm text-muted-foreground">
                          {enrollment.class.teacher.name}
                          {enrollment.class.subject && ` • ${enrollment.class.subject}`}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <FileText className="h-4 w-4" />
                        {enrollment.class._count.assessments} assessments
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Assessments */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Assessments</CardTitle>
            <CardDescription>Your latest assessment results</CardDescription>
          </CardHeader>
          <CardContent>
            {recentAssessments.length === 0 ? (
              <div className="text-center py-8">
                <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
                <p className="text-muted-foreground">No assessments yet</p>
              </div>
            ) : (
              <div className="space-y-4">
                {recentAssessments.map((assessment) => {
                  const submission = assessment.submissions[0];
                  const hasSubmitted = !!submission;
                  const isGraded = submission?.status === "GRADED";

                  return (
                    <Link
                      key={assessment.id}
                      href={`/assessments/${assessment.id}`}
                      className="block"
                    >
                      <div className="flex items-center justify-between p-4 rounded-lg border hover:bg-accent/50 transition-colors">
                        <div>
                          <h4 className="font-medium">{assessment.title}</h4>
                          <p className="text-sm text-muted-foreground">
                            {assessment.class.name}
                          </p>
                          {assessment.dueDate && (
                            <p className="text-xs text-muted-foreground mt-1">
                              Due: {formatDate(assessment.dueDate)}
                            </p>
                          )}
                        </div>
                        <div className="text-right">
                          {!hasSubmitted ? (
                            <Badge variant="outline">Not submitted</Badge>
                          ) : isGraded ? (
                            <div>
                              <span
                                className={`text-lg font-bold ${getScoreColor(
                                  submission.score || 0,
                                  assessment.totalMarks
                                )}`}
                              >
                                {submission.score}/{assessment.totalMarks}
                              </span>
                            </div>
                          ) : (
                            <Badge variant="warning">Processing</Badge>
                          )}
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <Card key={i}>
            <CardHeader className="pb-2">
              <Skeleton className="h-4 w-24" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-16" />
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        {[...Array(2)].map((_, i) => (
          <Card key={i}>
            <CardHeader>
              <Skeleton className="h-6 w-32" />
              <Skeleton className="h-4 w-48" />
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {[...Array(3)].map((_, j) => (
                  <Skeleton key={j} className="h-20 w-full" />
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
