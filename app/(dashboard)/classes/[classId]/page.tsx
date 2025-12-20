"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import Link from "next/link";
import {
  ArrowLeft,
  Copy,
  FileText,
  Plus,
  Users,
  Calendar,
  CheckCircle2,
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
import { useToast } from "@/hooks/use-toast";
import { formatDate } from "@/lib/utils";

interface ClassDetail {
  id: string;
  name: string;
  code: string;
  description: string | null;
  subject: string | null;
  createdAt: string;
  teacher: {
    id: string;
    name: string;
    email: string;
  };
  enrollments: {
    id: string;
    joinedAt: string;
    student: {
      id: string;
      name: string;
      email: string;
    };
  }[];
  assessments: {
    id: string;
    title: string;
    totalMarks: number;
    dueDate: string | null;
    status: string;
    createdAt: string;
    _count: {
      submissions: number;
    };
  }[];
}

export default function ClassDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { data: session } = useSession();
  const { toast } = useToast();
  const [classData, setClassData] = useState<ClassDetail | null>(null);
  const [loading, setLoading] = useState(true);

  const isTeacher = session?.user?.role === "TEACHER";
  const classId = params.classId as string;

  const fetchClassDetails = useCallback(async () => {
    try {
      const response = await fetch(`/api/classes/${classId}`);

      if (!response.ok) {
        throw new Error("Class not found");
      }

      const data = await response.json();
      setClassData(data.class);
    } catch {
      toast({
        title: "Error",
        description: "Failed to load class details",
        variant: "destructive",
      });
      router.push("/classes");
    } finally {
      setLoading(false);
    }
  }, [classId, toast, router]);

  useEffect(() => {
    fetchClassDetails();
  }, [fetchClassDetails]);

  const copyClassCode = () => {
    if (classData?.code) {
      navigator.clipboard.writeText(classData.code);
      toast({
        title: "Copied!",
        description: "Class code copied to clipboard",
      });
    }
  };

  if (loading) {
    return <ClassDetailSkeleton />;
  }

  if (!classData) {
    return null;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div className="flex items-start gap-4">
          <Link href="/classes">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{classData.name}</h1>
            <p className="text-muted-foreground">
              {classData.subject || "No subject"} • Created{" "}
              {formatDate(classData.createdAt)}
            </p>
            {!isTeacher && (
              <p className="text-sm text-muted-foreground mt-1">
                Teacher: {classData.teacher.name}
              </p>
            )}
          </div>
        </div>

        {isTeacher && (
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={copyClassCode}>
              <Copy className="h-4 w-4 mr-2" />
              {classData.code}
            </Button>
            <Link href={`/classes/${classId}/assessments/new`}>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                New Assessment
              </Button>
            </Link>
          </div>
        )}
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Students</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {classData.enrollments.length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Assessments</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {classData.assessments.length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {classData.assessments.filter((a) => a.status === "ACTIVE").length}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="assessments" className="space-y-4">
        <TabsList>
          <TabsTrigger value="assessments">
            <FileText className="h-4 w-4 mr-2" />
            Assessments
          </TabsTrigger>
          {isTeacher && (
            <TabsTrigger value="students">
              <Users className="h-4 w-4 mr-2" />
              Students
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="assessments" className="space-y-4">
          {classData.assessments.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium mb-2">No assessments yet</h3>
                <p className="text-muted-foreground mb-4">
                  {isTeacher
                    ? "Create your first assessment to get started."
                    : "No assessments have been created for this class yet."}
                </p>
                {isTeacher && (
                  <Link href={`/classes/${classId}/assessments/new`}>
                    <Button>
                      <Plus className="h-4 w-4 mr-2" />
                      Create Assessment
                    </Button>
                  </Link>
                )}
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {classData.assessments.map((assessment) => (
                <Link
                  key={assessment.id}
                  href={`/assessments/${assessment.id}`}
                >
                  <Card className="hover:bg-accent/50 transition-colors cursor-pointer">
                    <CardContent className="p-6">
                      <div className="flex items-center justify-between">
                        <div className="space-y-1">
                          <h3 className="font-medium">{assessment.title}</h3>
                          <div className="flex items-center gap-4 text-sm text-muted-foreground">
                            <span>Total: {assessment.totalMarks} marks</span>
                            {assessment.dueDate && (
                              <span className="flex items-center gap-1">
                                <Calendar className="h-3 w-3" />
                                Due: {formatDate(assessment.dueDate)}
                              </span>
                            )}
                            {isTeacher && (
                              <span className="flex items-center gap-1">
                                <Users className="h-3 w-3" />
                                {assessment._count.submissions} submissions
                              </span>
                            )}
                          </div>
                        </div>
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
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </TabsContent>

        {isTeacher && (
          <TabsContent value="students" className="space-y-4">
            {classData.enrollments.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-medium mb-2">No students yet</h3>
                  <p className="text-muted-foreground mb-4">
                    Share the class code{" "}
                    <span className="font-mono font-bold">{classData.code}</span>{" "}
                    with your students so they can join.
                  </p>
                  <Button variant="outline" onClick={copyClassCode}>
                    <Copy className="h-4 w-4 mr-2" />
                    Copy Class Code
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardHeader>
                  <CardTitle>Enrolled Students</CardTitle>
                  <CardDescription>
                    {classData.enrollments.length} students enrolled in this class
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="divide-y">
                    {classData.enrollments.map((enrollment) => (
                      <div
                        key={enrollment.id}
                        className="flex items-center justify-between py-4"
                      >
                        <div>
                          <p className="font-medium">{enrollment.student.name}</p>
                          <p className="text-sm text-muted-foreground">
                            {enrollment.student.email}
                          </p>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          Joined {formatDate(enrollment.joinedAt)}
                        </p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}

function ClassDetailSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-start gap-4">
        <Skeleton className="h-10 w-10 rounded" />
        <div>
          <Skeleton className="h-8 w-64 mb-2" />
          <Skeleton className="h-4 w-48" />
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        {[...Array(3)].map((_, i) => (
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
      <Skeleton className="h-10 w-64" />
      <div className="space-y-4">
        {[...Array(3)].map((_, i) => (
          <Skeleton key={i} className="h-24 w-full" />
        ))}
      </div>
    </div>
  );
}
