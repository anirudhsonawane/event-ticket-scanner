import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function GET() {
  const { count, error } = await supabase
    .from("tickets")
    .select("*", { count: "exact", head: true });

  if (error) {
    console.error("Supabase error:", error);

    return NextResponse.json(
      {
        success: false,
        error: error.message,
      },
      { status: 500 },
    );
  }

  return NextResponse.json({
    success: true,
    message: "Supabase connection successful",
    ticketCount: count ?? 0,
  });
}
