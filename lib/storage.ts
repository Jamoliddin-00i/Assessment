import path from "path";
import fs from "fs/promises";
import type { NextRequest } from "next/server";

const uploadRoot = path.join(process.cwd(), "uploads");

export async function saveUpload(req: NextRequest) {
    const form = await req.formData();
    const file = form.get("file");

    if (!file || typeof file === "string") {
        throw new Error("Missing file");
    }

    const arrayBuffer = await file.arrayBuffer();
    await fs.mkdir(uploadRoot, { recursive: true });

    const fileName = `${Date.now()}-${(file as File).name}`;
    const filePath = path.join(uploadRoot, fileName);

    await fs.writeFile(filePath, Buffer.from(arrayBuffer));

    return {
        filePath,
        originalName: (file as File).name,
        mimeType: (file as File).type,
    };
}
