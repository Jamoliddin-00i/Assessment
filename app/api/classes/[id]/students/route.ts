import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { Role } from "@prisma/client";

export async function GET(_: Request, { params }: { params: { id: string } }) {
    await requireRole(Role.TEACHER);
    const students = await prisma.classMembership.findMany({
        where: { classId: params.id },
        include: { student: true },
    });
    return NextResponse.json(students);
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
    await requireRole(Role.TEACHER);
    const body = await req.json();
    const student = await prisma.user.findUnique({ where: { email: body.email } });
    if (!student) {
        return NextResponse.json({ error: "Student not found" }, { status: 404 });
    }
    const membership = await prisma.classMembership.create({
        data: { classId: params.id, studentId: student.id },
    });
    return NextResponse.json(membership);
}
