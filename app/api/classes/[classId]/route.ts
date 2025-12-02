import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(
    _req: Request,
    { params }: { params: { classId: string } }
) {
    const session = await getServerSession(authOptions);
    if (!session) {
        return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const classData = await prisma.class.findUnique({
        where: { id: params.classId },
        include: {
            memberships: {
                include: {
                    student: { select: { id: true, name: true, email: true } },
                },
            },
            assessments: { orderBy: { date: "desc" } },
        },
    });

    if (!classData) {
        return NextResponse.json({ message: "Class not found" }, { status: 404 });
    }

    if (session.user.role === "TEACHER" && classData.teacherId !== session.user.id) {
        return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    }

    if (session.user.role === "STUDENT") {
        const isMember = classData.memberships.some(
            (m) => m.student.id === session.user.id
        );
        if (!isMember) {
            return NextResponse.json({ message: "Forbidden" }, { status: 403 });
        }
    }

    return NextResponse.json(classData);
}
