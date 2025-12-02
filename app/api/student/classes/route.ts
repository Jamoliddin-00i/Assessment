import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
    const session = await getServerSession(authOptions);

    if (!session || session.user.role !== "STUDENT") {
        return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    try {
        const memberships = await prisma.classMembership.findMany({
            where: {
                studentId: session.user.id,
            },
            include: {
                class: {
                    include: {
                        teacher: {
                            select: { name: true },
                        },
                    },
                },
            },
            orderBy: {
                createdAt: "desc",
            },
        });

        const classes = memberships.map((m) => ({
            ...m.class,
            joinedAt: m.createdAt,
        }));

        return NextResponse.json(classes);
    } catch (error) {
        return NextResponse.json({ message: "Internal Error" }, { status: 500 });
    }
}
