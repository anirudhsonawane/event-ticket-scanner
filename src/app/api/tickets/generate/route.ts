import { NextResponse } from "next/server";
import crypto from "crypto";
import { supabase } from "@/lib/supabase";

export async function POST() {
  try {
    // Check existing ticket count
    const { count, error: countError } = await supabase
      .from("tickets")
      .select("*", {
        count: "exact",
        head: true,
      });

    if (countError) {
      console.error("COUNT ERROR:", countError);

      return NextResponse.json(
        {
          success: false,
          step: "checking_existing_tickets",
          error: countError.message,
          details: countError,
        },
        { status: 500 },
      );
    }

    // Prevent duplicate generation
    if ((count ?? 0) > 0) {
      return NextResponse.json(
        {
          success: false,
          message: `Tickets already exist. Current count: ${count}`,
        },
        { status: 409 },
      );
    }

    // Generate 250 SINGLE tickets
    const singleTickets = Array.from({ length: 250 }, (_, index) => ({
      ticket_code: `SGL-${String(index + 1).padStart(4, "0")}`,
      ticket_type: "SINGLE",
      qr_token: crypto.randomBytes(32).toString("hex"),
      status: "UNUSED",
    }));

    // Generate 250 COUPLE tickets
    const coupleTickets = Array.from({ length: 250 }, (_, index) => ({
      ticket_code: `CPL-${String(index + 1).padStart(4, "0")}`,
      ticket_type: "COUPLE",
      qr_token: crypto.randomBytes(32).toString("hex"),
      status: "UNUSED",
    }));

    const tickets = [...singleTickets, ...coupleTickets];

    console.log(`Preparing ${tickets.length} tickets...`);

    // Insert without requesting the inserted rows back.
    const { error: insertError } = await supabase
      .from("tickets")
      .insert(tickets);

    if (insertError) {
      console.error("INSERT ERROR:", insertError);

      return NextResponse.json(
        {
          success: false,
          step: "inserting_tickets",
          error: insertError.message,
          details: insertError,
        },
        { status: 500 },
      );
    }

    // Verify the result
    const { count: finalCount, error: verifyError } = await supabase
      .from("tickets")
      .select("*", {
        count: "exact",
        head: true,
      });

    if (verifyError) {
      console.error("VERIFY ERROR:", verifyError);

      return NextResponse.json({
        success: true,
        message: "Tickets were inserted, but verification failed.",
        total: 500,
      });
    }

    return NextResponse.json({
      success: true,
      message: "Tickets generated successfully.",
      total: finalCount,
      single: 250,
      couple: 250,
    });
  } catch (error: unknown) {
    console.error("UNEXPECTED ERROR:", error);

    return NextResponse.json(
      {
        success: false,
        step: "unexpected_error",
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
