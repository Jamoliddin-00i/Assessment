import { getAuthSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { TeacherDashboard } from "@/components/dashboard/teacher-dashboard";
import { StudentDashboard } from "@/components/dashboard/student-dashboard";

export default async function DashboardPage() {
  const session = await getAuthSession();

  if (!session) {
    redirect("/login");
  }

  const isTeacher = session.user.role === "TEACHER";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">
          Welcome back, {session.user.name?.split(" ")[0]}!
        </h1>
        <p className="text-muted-foreground">
          {isTeacher
            ? "Manage your classes and assessments"
            : "View your classes and assessment results"}
        </p>
      </div>

      {isTeacher ? <TeacherDashboard /> : <StudentDashboard />}
    </div>
  );
}
