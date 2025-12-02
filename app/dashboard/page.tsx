"use client";

import { useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";

export default function DashboardPage() {
    const { data: session, status } = useSession();
    const router = useRouter();

    useEffect(() => {
        if (status === "unauthenticated") {
            router.replace("/login");
            return;
        }
        if (status === "authenticated" && session?.user) {
            const role = (session.user as any).role;
            router.replace(role === "TEACHER" ? "/teacher/dashboard" : "/student/dashboard");
        }
    }, [router, session, status]);

    return <div className="p-6">Redirecting...</div>;
}
