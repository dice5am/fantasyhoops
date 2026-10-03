import { NextResponse } from "next/server";
import { getDraftBoard } from "@/lib/loadDraftBoard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/draft-board
 * Last = 2025-26 reg_only published scores.
 * 3yr + cosine neighbors are published marts (no new fantasy math).
 * Playoffs off. No Yahoo.
 */
export async function GET() {
  try {
    const payload = await getDraftBoard();
    return NextResponse.json(payload);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      {
        error: message,
        code: "DRAFT_BOARD_UNAVAILABLE",
      },
      { status: 503 }
    );
  }
}
