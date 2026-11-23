import { NextResponse } from "next/server";
import { sql } from "@/db";

export async function GET() {
  try {
    await sql`SELECT 1`;
    return NextResponse.json({
      ok: true,
      db: "up",
      openaiKeyConfigured: Boolean(process.env.OPENAI_API_KEY),
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        db: "down",
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 503 },
    );
  }
}
