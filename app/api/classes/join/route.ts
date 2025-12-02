import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
    const session = await getServerSession(authOptions);

    if (!session || session.user.role !== "STUDENT") {
        return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    try {
        const { code } = await req.json();

        if (!code) {
            return NextResponse.json({ message: "Code is required" }, { status: 400 });
        }

        const classToJoin = await prisma.class.findUnique({
            where: { code },
        });

        if (!classToJoin) {
            return NextResponse.json({ message: "Invalid class code" }, { status: 404 });
        }

        const existingMembership = await prisma.classMembership.findUnique({
            where: {
                classId_studentId: {
                    classId: classToJoin.id,
                    studentId: session.user.id,
                },
            },
        });

        if (existingMembership) {
            return NextResponse.json({ message: "Already a member" }, { status: 400 });
        }

        await prisma.classMembership.create({
            data: {
                classId: classToJoin.id,
                studentId: session.user.id,
            },
        });

        return NextResponse.json({ message: "Joined successfully" }, { status: 200 });
    } catch (error) {
        return NextResponse.json({ message: "Internal Error" }, { status: 500 });
    }
}
