import { NextRequest, NextResponse } from "next/server";
import { translate, type Direction } from "@/lib/translate";

const VALID_DIRECTIONS: Direction[] = ["auto", "en-ja", "ja-en", "fil-ja", "ja-fil"];

export async function POST(request: NextRequest) {
  let body: { text?: unknown; direction?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const text = typeof body.text === "string" ? body.text.trim() : "";
  if (!text) {
    return NextResponse.json({ error: "`text` is required." }, { status: 400 });
  }
  if (text.length > 2000) {
    return NextResponse.json(
      { error: "Text is too long (max 2000 characters)." },
      { status: 400 }
    );
  }

  const direction = VALID_DIRECTIONS.includes(body.direction as Direction)
    ? (body.direction as Direction)
    : "auto";

  try {
    const result = await translate(text, direction);
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Translation failed.";
    const status = message.includes("ANTHROPIC_API_KEY") ? 503 : 502;
    return NextResponse.json({ error: message }, { status });
  }
}
