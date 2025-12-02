import { NextResponse } from "next/server";

export async function POST() {
    return NextResponse.json(
        { message: "Deprecated. Use /api/auth/register instead." },
        { status: 410 }
    );
}
