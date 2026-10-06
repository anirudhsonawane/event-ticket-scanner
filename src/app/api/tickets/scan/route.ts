import { NextRequest } from "next/server";

import { supabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";

const VENUE = "Gurukul School Near Darga Road";

type ScanPayload = {
  ticketCode?: unknown;
  token?: unknown;
  gate?: unknown;
  scannedBy?: unknown;
};

type Ticket = {
  id: string;
  ticket_code: string;
  ticket_type: string;
  qr_token: string;
  status: string;
  created_at: string;
  check_in_time: string | null;
  scanned_by: string | null;
  gate: string | null;
};

function isValidString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function normalizeTicketType(ticketType: string): string {
  if (ticketType.toUpperCase() === "SINGLE") {
    return "Single";
  }

  if (ticketType.toUpperCase() === "COUPLE") {
    return "Couple";
  }

  return ticketType;
}

export async function POST(request: NextRequest): Promise<Response> {
  try {
    const body = (await request.json()) as ScanPayload;

    const ticketCode = isValidString(body.ticketCode)
      ? body.ticketCode.trim()
      : "";

    const token = isValidString(body.token) ? body.token.trim() : "";

    const gate = isValidString(body.gate) ? body.gate.trim() : "Gate 1";

    const scannedBy = isValidString(body.scannedBy)
      ? body.scannedBy.trim()
      : "ADMIN_SCANNER";

    if (!ticketCode || !token) {
      return Response.json(
        {
          success: false,
          valid: false,
          status: "INVALID",
          message: "Invalid QR code.",
        },
        {
          status: 400,
        },
      );
    }

    /*
     * Find the ticket using BOTH:
     *
     * ticket_code
     * +
     * qr_token
     *
     * This prevents somebody from changing the
     * visible ticket code and getting a valid result.
     */
    const { data, error } = await supabaseAdmin
      .from("tickets")
      .select(
        `
            id,
            ticket_code,
            ticket_type,
            qr_token,
            status,
            created_at,
            check_in_time,
            scanned_by,
            gate
          `,
      )
      .eq("ticket_code", ticketCode)
      .eq("qr_token", token)
      .maybeSingle();

    if (error) {
      console.error("Ticket lookup error:", error);

      return Response.json(
        {
          success: false,
          valid: false,
          status: "ERROR",
          message: "Unable to validate ticket.",
        },
        {
          status: 500,
        },
      );
    }

    if (!data) {
      return Response.json(
        {
          success: false,
          valid: false,
          status: "INVALID",
          message: "Invalid ticket or QR code.",
        },
        {
          status: 404,
        },
      );
    }

    const ticket = data as Ticket;

    /*
     * If the ticket was already used,
     * NEVER allow it through again.
     */
    if (ticket.status === "USED") {
      return Response.json(
        {
          success: false,
          valid: false,
          status: "USED",
          message: "Ticket already used.",

          ticket: {
            ticketId: ticket.ticket_code,

            ticketType: normalizeTicketType(ticket.ticket_type),

            date: ticket.created_at,

            venue: VENUE,

            checkInTime: ticket.check_in_time,

            scannedBy: ticket.scanned_by,

            gate: ticket.gate,
          },
        },
        {
          status: 409,
        },
      );
    }

    /*
     * CRITICAL:
     *
     * Only change UNUSED -> USED.
     *
     * This conditional update makes the check-in
     * safe against two scanners scanning the same
     * QR at almost exactly the same time.
     */
    const { data: updatedRows, error: updateError } = await supabaseAdmin
      .from("tickets")
      .update({
        status: "USED",
        check_in_time: new Date().toISOString(),
        scanned_by: scannedBy,
        gate: gate,
      })
      .eq("id", ticket.id)
      .eq("status", "UNUSED")
      .select(
        `
            id,
            ticket_code,
            ticket_type,
            qr_token,
            status,
            created_at,
            check_in_time,
            scanned_by,
            gate
          `,
      );

    if (updateError) {
      console.error("Ticket check-in update error:", updateError);

      return Response.json(
        {
          success: false,
          valid: false,
          status: "ERROR",
          message: "Unable to complete ticket check-in.",
        },
        {
          status: 500,
        },
      );
    }

    /*
     * If nothing was updated, another scanner
     * won the race and the ticket is now USED.
     */
    if (!updatedRows || updatedRows.length === 0) {
      const { data: currentTicket } = await supabaseAdmin
        .from("tickets")
        .select(
          `
              ticket_code,
              ticket_type,
              created_at,
              check_in_time,
              scanned_by,
              gate,
              status
            `,
        )
        .eq("id", ticket.id)
        .maybeSingle();

      return Response.json(
        {
          success: false,
          valid: false,
          status: "USED",
          message: "Ticket already used.",

          ticket: currentTicket
            ? {
                ticketId: currentTicket.ticket_code,

                ticketType: normalizeTicketType(currentTicket.ticket_type),

                date: currentTicket.created_at,

                venue: VENUE,

                checkInTime: currentTicket.check_in_time,

                scannedBy: currentTicket.scanned_by,

                gate: currentTicket.gate,
              }
            : {
                ticketId: ticketCode,

                ticketType: "Unknown",

                date: null,

                venue: VENUE,

                checkInTime: null,

                scannedBy: null,

                gate: null,
              },
        },
        {
          status: 409,
        },
      );
    }

    const checkedInTicket = updatedRows[0] as Ticket;

    /*
     * Successful first scan.
     */
    return Response.json(
      {
        success: true,
        valid: true,
        status: "USED",
        message: "Entry valid.",

        ticket: {
          ticketId: checkedInTicket.ticket_code,

          ticketType: normalizeTicketType(checkedInTicket.ticket_type),

          date: checkedInTicket.created_at,

          venue: VENUE,

          checkInTime: checkedInTicket.check_in_time,

          scannedBy: checkedInTicket.scanned_by,

          gate: checkedInTicket.gate,
        },
      },
      {
        status: 200,
      },
    );
  } catch (error) {
    console.error("Ticket scan error:", error);

    return Response.json(
      {
        success: false,
        valid: false,
        status: "ERROR",
        message: "Invalid scan request.",
      },
      {
        status: 400,
      },
    );
  }
}
