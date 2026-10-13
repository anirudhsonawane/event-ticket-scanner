import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";

const DEFAULT_MAX_SCANS = 2;
const VENUE = "Gurukul School Near Darga Road";

type ScanPayload = {
  qrToken?: unknown;
  token?: unknown;
  ticketCode?: unknown;
};

type TicketType = "SINGLE" | "COUPLE";
type TicketTable = "single_tickets" | "couple_tickets";

type TicketRow = {
  id: string;
  ticket_code: string;
  qr_token: string;
  status: string;
  created_at: string;
  scanned_at: string | null;
  scan_count: number | null;
  scan_limit: number | null;
};

type FoundTicket = {
  ticket: TicketRow;
  ticketType: TicketType;
  table: TicketTable;
};

function isValidString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function formatTicketType(type: TicketType): string {
  return type === "SINGLE" ? "Single" : "Couple";
}

function responseTicket(found: FoundTicket, scanCount: number) {
  const scanLimit = Math.max(
    1,
    Number(found.ticket.scan_limit ?? DEFAULT_MAX_SCANS),
  );

  return {
    ticketId: found.ticket.ticket_code,
    ticketType: formatTicketType(found.ticketType),
    date: found.ticket.created_at,
    venue: VENUE,
    scannedAt: found.ticket.scanned_at,
    scanCount,
    scanLimit,
    scansRemaining: Math.max(0, scanLimit - scanCount),
  };
}

async function findTicket(
  qrToken: string,
  ticketCode: string,
): Promise<FoundTicket | null> {
  const tables: Array<{
    table: TicketTable;
    ticketType: TicketType;
  }> = [
    { table: "single_tickets", ticketType: "SINGLE" },
    { table: "couple_tickets", ticketType: "COUPLE" },
  ];

  for (const entry of tables) {
    let query = supabaseAdmin
      .from(entry.table)
      .select(
        "id, ticket_code, qr_token, status, created_at, scanned_at, scan_count, scan_limit",
      );

    query = qrToken
      ? query.eq("qr_token", qrToken)
      : query.eq("ticket_code", ticketCode);

    const { data, error } = await query.maybeSingle();

    if (error) {
      console.error(`Ticket lookup failed in ${entry.table}:`, error);
      throw new Error("Unable to search tickets.");
    }

    if (data) {
      return {
        ticket: data as TicketRow,
        ticketType: entry.ticketType,
        table: entry.table,
      };
    }
  }

  return null;
}

export async function POST(request: NextRequest): Promise<Response> {
  try {
    let body: ScanPayload;

    try {
      body = (await request.json()) as ScanPayload;
    } catch {
      return NextResponse.json(
        {
          success: false,
          valid: false,
          status: "INVALID",
          message: "Invalid scan request.",
        },
        { status: 400 },
      );
    }

    const qrToken = isValidString(body.qrToken)
      ? body.qrToken.trim()
      : isValidString(body.token)
        ? body.token.trim()
        : "";

    const ticketCode = isValidString(body.ticketCode)
      ? body.ticketCode.trim()
      : "";

    if (!qrToken && !ticketCode) {
      return NextResponse.json(
        {
          success: false,
          valid: false,
          status: "INVALID",
          message: "Invalid QR code.",
        },
        { status: 400 },
      );
    }

    const found = await findTicket(qrToken, ticketCode);

    if (!found) {
      return NextResponse.json(
        {
          success: false,
          valid: false,
          status: "INVALID",
          message: "Invalid ticket or QR code.",
        },
        { status: 404 },
      );
    }

    for (let attempt = 0; attempt < 3; attempt += 1) {
      const { data: current, error: readError } = await supabaseAdmin
        .from(found.table)
        .select(
          "id, ticket_code, qr_token, status, created_at, scanned_at, scan_count, scan_limit",
        )
        .eq("id", found.ticket.id)
        .maybeSingle();

      if (readError || !current) {
        console.error("Ticket read before check-in failed:", readError);

        return NextResponse.json(
          {
            success: false,
            valid: false,
            status: "ERROR",
            message: "Unable to read ticket.",
          },
          { status: 500 },
        );
      }

      const currentCount = Math.max(0, Number(current.scan_count ?? 0));

      const scanLimit = Math.max(
        1,
        Number(current.scan_limit ?? DEFAULT_MAX_SCANS),
      );

      found.ticket = current as TicketRow;

      if (currentCount >= scanLimit) {
        return NextResponse.json(
          {
            success: false,
            valid: false,
            status: "EXHAUSTED",
            message:
              scanLimit === 1
                ? "This new QR code has already been scanned. Entry is not allowed again."
                : "Scan limit reached. This old QR code has already been accepted twice.",
            ticket: responseTicket(found, currentCount),
          },
          { status: 409 },
        );
      }

      const nextCount = currentCount + 1;
      const scannedAt = new Date().toISOString();

      const { data: updated, error: updateError } = await supabaseAdmin
        .from(found.table)
        .update({
          scan_count: nextCount,
          status: "USED",
          scanned_at: scannedAt,
        })
        .eq("id", current.id)
        .eq("scan_count", current.scan_count ?? 0)
        .select(
          "id, ticket_code, qr_token, status, created_at, scanned_at, scan_count, scan_limit",
        )
        .maybeSingle();

      if (updateError) {
        console.error("Ticket scan update failed:", updateError);

        return NextResponse.json(
          {
            success: false,
            valid: false,
            status: "ERROR",
            message: "Unable to complete ticket check-in.",
          },
          { status: 500 },
        );
      }

      if (!updated) {
        // Another scanner changed the record.
        // Re-read and enforce its current scan limit.
        continue;
      }

      found.ticket = updated as TicketRow;

      return NextResponse.json({
        success: true,
        valid: true,
        status: "USED",
        message:
          scanLimit === 1
            ? "Entry valid. This new QR code has been accepted once."
            : `Entry valid. Scan ${nextCount} of ${scanLimit} accepted.`,
        ticket: responseTicket(found, nextCount),
      });
    }

    const { data: latest } = await supabaseAdmin
      .from(found.table)
      .select(
        "id, ticket_code, qr_token, status, created_at, scanned_at, scan_count, scan_limit",
      )
      .eq("id", found.ticket.id)
      .maybeSingle();

    const latestCount = Math.max(0, Number(latest?.scan_count ?? 0));

    const latestLimit = Math.max(
      1,
      Number(latest?.scan_limit ?? DEFAULT_MAX_SCANS),
    );

    const exhausted = latestCount >= latestLimit;

    return NextResponse.json(
      {
        success: false,
        valid: false,
        status: exhausted ? "EXHAUSTED" : "ERROR",
        message: exhausted
          ? latestLimit === 1
            ? "This new QR code has already been scanned. Entry is not allowed again."
            : "Scan limit reached. This old QR code has already been accepted twice."
          : "Could not safely record this scan. Please try again.",
        ...(latest
          ? {
              ticket: responseTicket(
                {
                  ...found,
                  ticket: latest as TicketRow,
                },
                latestCount,
              ),
            }
          : {}),
      },
      { status: exhausted ? 409 : 503 },
    );
  } catch (error) {
    console.error("Ticket scan error:", error);

    return NextResponse.json(
      {
        success: false,
        valid: false,
        status: "ERROR",
        message:
          error instanceof Error ? error.message : "Invalid scan request.",
      },
      { status: 500 },
    );
  }
}
