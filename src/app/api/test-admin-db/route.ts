import { NextResponse } from "next/server";

import { supabaseAdmin } from "@/lib/supabase-admin";

export async function GET() {
  const { data, error } = await supabaseAdmin
    .from("tickets")
    .select("id")
    .limit(1);

  if (error) {
    return NextResponse.json(
      {
        success: false,
        error: error.message,
        code: error.code,
      },
      {
        status: 500,
      },
    );
  }

  return NextResponse.json({
    success: true,
    message: "Server-side Supabase connection is working.",
    rowsFound: data?.length ?? 0,
  });
}
