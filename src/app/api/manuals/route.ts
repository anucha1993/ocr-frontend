import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export async function GET() {
  const dir = path.join(process.cwd(), "public", "manual");

  if (!fs.existsSync(dir)) {
    return NextResponse.json([]);
  }

  const files = fs.readdirSync(dir)
    .filter((f) => f.toLowerCase().endsWith(".pdf"))
    .map((f) => ({
      name: f.replace(/\.pdf$/i, "").replace(/[-_]/g, " "),
      filename: f,
      url: `/manual/${f}`,
    }));

  return NextResponse.json(files);
}
