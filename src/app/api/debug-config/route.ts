import { NextResponse } from "next/server";
import crypto from "crypto";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;

export async function POST() {
  try {
    // Check existing tickets first
    const checkResponse = await fetch(
      `${supabaseUrl}/rest/v1/tickets?select=id&limit=1`,
      {
        method: "GET",
        headers: {
          apikey: supabaseKey,
          Authorization: `Bearer ${supabaseKey}`,
        },
        cache: "no-store",
      },
    );

    if (!checkResponse.ok) {
      const errorText = await checkResponse.text();

      return NextResponse.json(
        {
          success: false,
          step: "checking_existing_tickets",
          status: checkResponse.status,
          error: errorText,
        },
        { status: 500 },
      );
    }

    // Check total count
    const countResponse = await fetch(
      `${supabaseUrl}/rest/v1/tickets?select=id`,
      {
        method: "HEAD",
        headers: {
          apikey: supabaseKey,
          Authorization: `Bearer ${supabaseKey}`,
          Prefer: "count=exact",
        },
        cache: "no-store",
      },
    );

    const contentRange = countResponse.headers.get("content-range");

    if (contentRange) {
      const match = contentRange.match(/\/(\d+)$/);

      if (match && Number(match[1]) > 0) {
        return NextResponse.json(
          {
            success: false,
            message: `Tickets already exist. Current count: ${match[1]}`,
          },
          { status: 409 },
        );
      }
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

    // Insert directly into Supabase REST API
    const insertResponse = await fetch(`${supabaseUrl}/rest/v1/tickets`, {
      method: "POST",
      headers: {
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify(tickets),
      cache: "no-store",
    });

    if (!insertResponse.ok) {
      const errorText = await insertResponse.text();

      console.error("SUPABASE INSERT ERROR:", {
        status: insertResponse.status,
        response: errorText,
      });

      return NextResponse.json(
        {
          success: false,
          step: "inserting_tickets",
          status: insertResponse.status,
          error: errorText,
        },
        { status: 500 },
      );
    }

    // Verify final count
    const verifyResponse = await fetch(
      `${supabaseUrl}/rest/v1/tickets?select=id`,
      {
        method: "GET",
        headers: {
          apikey: supabaseKey,
          Authorization: `Bearer ${supabaseKey}`,
          Prefer: "count=exact",
        },
        cache: "no-store",
      },
    );

    const verifyContentRange = verifyResponse.headers.get("content-range");

    const finalCount = verifyContentRange
      ? verifyContentRange.split("/")[1]
      : "unknown";

    return NextResponse.json({
      success: true,
      message: "Tickets generated successfully.",
      total: finalCount,
      single: 250,
      couple: 250,
    });
  } catch (error) {
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
