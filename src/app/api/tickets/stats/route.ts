import { NextResponse } from "next/server";

import { supabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";

export async function GET() {
  try {
    const [totalResult, singleResult, coupleResult, unusedResult, usedResult] =
      await Promise.all([
        supabaseAdmin.from("tickets").select("id", {
          count: "exact",
          head: true,
        }),

        supabaseAdmin
          .from("tickets")
          .select("id", {
            count: "exact",
            head: true,
          })
          .eq("ticket_type", "SINGLE"),

        supabaseAdmin
          .from("tickets")
          .select("id", {
            count: "exact",
            head: true,
          })
          .eq("ticket_type", "COUPLE"),

        supabaseAdmin
          .from("tickets")
          .select("id", {
            count: "exact",
            head: true,
          })
          .eq("status", "UNUSED"),

        supabaseAdmin
          .from("tickets")
          .select("id", {
            count: "exact",
            head: true,
          })
          .eq("status", "USED"),
      ]);

    const errors = [
      totalResult.error,
      singleResult.error,
      coupleResult.error,
      unusedResult.error,
      usedResult.error,
    ].filter(Boolean);

    if (errors.length > 0) {
      console.error("[TICKET STATS]", errors);

      return NextResponse.json(
        {
          success: false,
          message: "Unable to load ticket statistics.",
        },
        {
          status: 500,
        },
      );
    }

    const total = totalResult.count ?? 0;
    const single = singleResult.count ?? 0;
    const couple = coupleResult.count ?? 0;
    const unused = unusedResult.count ?? 0;
    const used = usedResult.count ?? 0;

    return NextResponse.json({
      success: true,

      tickets: {
        total,
        single,
        couple,
        unused,
        used,
      },

      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[TICKET STATS] Fatal error:", error);

    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : "Unable to load ticket statistics.",
      },
      {
        status: 500,
      },
    );
  }
}
