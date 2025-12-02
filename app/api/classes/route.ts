import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { Role } from "@prisma/client";

export async function GET() {
    await requireRole(Role.TEACHER);
    const classes = await prisma.class.findMany({
        include: { assessments: true, memberships: true },
        orderBy: { createdAt: "desc" },
    });
    return NextResponse.json(classes);
}

export async function POST(req: Request) {
    const session = await requireRole(Role.TEACHER);
    const body = await req.json();

    if (!body.name) {
        return NextResponse.json({ error: "Name required" }, { status: 400 });
    }

    const code = randomBytes(4).toString("hex").toUpperCase();
    const cls = await prisma.class.create({
        data: { name: body.name, code, teacherId: (session.user as any).id },
    });

    return NextResponse.json(cls);
}
