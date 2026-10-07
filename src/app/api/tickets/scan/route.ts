import { NextRequest } from "next/server";

import { supabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";

const VENUE = "Gurukul School Near Darga Road";

type ScanPayload = {
  qrToken?: unknown;
  token?: unknown;
  ticketCode?: unknown;
};

type TicketType = "SINGLE" | "COUPLE";

type Ticket = {
  id: string;
  ticket_code: string;
  qr_token: string;
  status: string;
  created_at: string;
  scanned_at: string | null;
  ticket_type: TicketType;
};

function isValidString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

/* =========================================================
   FORMAT TICKET TYPE
   ========================================================= */

function normalizeTicketType(ticketType: TicketType): string {
  if (ticketType === "SINGLE") {
    return "Single";
  }

  return "Couple";
}

/* =========================================================
   FORMAT RESPONSE
   ========================================================= */

function ticketResponse(ticket: Ticket) {
  return {
    ticketId: ticket.ticket_code,

    ticketType: normalizeTicketType(ticket.ticket_type),

    date: ticket.created_at,

    venue: VENUE,

    scannedAt: ticket.scanned_at,
  };
}

/* =========================================================
   FIND TICKET
   ========================================================= */

async function findTicket(qrToken: string, ticketCode: string) {
  /*
   * =======================================================
   * FIRST: SEARCH SINGLE TICKETS
   * =======================================================
   */

  let singleQuery = supabaseAdmin.from("single_tickets").select(
    `
        id,
        ticket_code,
        qr_token,
        status,
        created_at,
        scanned_at
      `,
  );

  if (qrToken) {
    singleQuery = singleQuery.eq("qr_token", qrToken);
  } else {
    singleQuery = singleQuery.eq("ticket_code", ticketCode);
  }

  const { data: singleTicket, error: singleError } =
    await singleQuery.maybeSingle();

  if (singleError) {
    console.error("Single ticket lookup error:", singleError);

    throw new Error("Unable to search single tickets.");
  }

  if (singleTicket) {
    return {
      ticket: {
        ...singleTicket,
        ticket_type: "SINGLE" as const,
      } as Ticket,

      table: "single_tickets" as const,
    };
  }

  /*
   * =======================================================
   * SECOND: SEARCH COUPLE TICKETS
   * =======================================================
   */

  let coupleQuery = supabaseAdmin.from("couple_tickets").select(
    `
        id,
        ticket_code,
        qr_token,
        status,
        created_at,
        scanned_at
      `,
  );

  if (qrToken) {
    coupleQuery = coupleQuery.eq("qr_token", qrToken);
  } else {
    coupleQuery = coupleQuery.eq("ticket_code", ticketCode);
  }

  const { data: coupleTicket, error: coupleError } =
    await coupleQuery.maybeSingle();

  if (coupleError) {
    console.error("Couple ticket lookup error:", coupleError);

    throw new Error("Unable to search couple tickets.");
  }

  if (coupleTicket) {
    return {
      ticket: {
        ...coupleTicket,
        ticket_type: "COUPLE" as const,
      } as Ticket,

      table: "couple_tickets" as const,
    };
  }

  return null;
}

/* =========================================================
   POST
   ========================================================= */

export async function POST(request: NextRequest): Promise<Response> {
  try {
    const body = (await request.json()) as ScanPayload;

    /*
     * =====================================================
     * GET QR TOKEN
     * =====================================================
     *
     * New QR codes contain ONLY qr_token.
     *
     * Example:
     *
     * "7c4c0d9e-..."
     *
     * No JSON is expected inside the QR.
     */

    const qrToken = isValidString(body.qrToken)
      ? body.qrToken.trim()
      : isValidString(body.token)
        ? body.token.trim()
        : "";

    const ticketCode = isValidString(body.ticketCode)
      ? body.ticketCode.trim()
      : "";

    if (!qrToken && !ticketCode) {
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

    /* =====================================================
       FIND TICKET
       ===================================================== */

    const result = await findTicket(qrToken, ticketCode);

    /*
     * =====================================================
     * TICKET NOT FOUND
     * =====================================================
     */

    if (!result) {
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

    const ticket = result.ticket;

    const table = result.table;

    /* =====================================================
       ALREADY USED
       ===================================================== */

    if (ticket.status === "USED") {
      return Response.json(
        {
          success: false,

          valid: false,

          status: "USED",

          message: "Ticket already used.",

          ticket: ticketResponse(ticket),
        },
        {
          status: 409,
        },
      );
    }

    /* =====================================================
       ATOMIC CHECK-IN
       =====================================================
       
       Only UNUSED tickets can be changed.

       scanned_at is written at the exact moment
       the ticket is successfully scanned.
    */

    const scannedAt = new Date().toISOString();

    const { data: updatedRows, error: updateError } = await supabaseAdmin
      .from(table)
      .update({
        status: "USED",

        scanned_at: scannedAt,
      })
      .eq("id", ticket.id)
      .eq("status", "UNUSED")
      .select(
        `
          id,
          ticket_code,
          qr_token,
          status,
          created_at,
          scanned_at
        `,
      );

    /* =====================================================
       UPDATE ERROR
       ===================================================== */

    if (updateError) {
      console.error("Ticket scan update error:", updateError);

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

    /* =====================================================
       ANOTHER SCANNER WON THE RACE
       =====================================================
       
       Example:

       Scanner A scans at 18:42:01
       Scanner B scans at 18:42:01

       Only one scanner should be accepted.
    */

    if (!updatedRows || updatedRows.length === 0) {
      const { data: currentTicket, error: currentTicketError } =
        await supabaseAdmin
          .from(table)
          .select(
            `
            id,
            ticket_code,
            qr_token,
            status,
            created_at,
            scanned_at
          `,
          )
          .eq("id", ticket.id)
          .maybeSingle();

      if (currentTicketError) {
        console.error("Unable to read current ticket:", currentTicketError);
      }

      const alreadyUsedTicket: Ticket = {
        ...(currentTicket ?? ticket),

        ticket_type: ticket.ticket_type,
      } as Ticket;

      return Response.json(
        {
          success: false,

          valid: false,

          status: "USED",

          message: "Ticket already used.",

          ticket: ticketResponse(alreadyUsedTicket),
        },
        {
          status: 409,
        },
      );
    }

    /* =====================================================
       FIRST SUCCESSFUL SCAN
       ===================================================== */

    const checkedInTicket: Ticket = {
      ...(updatedRows[0] as Omit<Ticket, "ticket_type">),

      ticket_type: ticket.ticket_type,
    };

    return Response.json(
      {
        success: true,

        valid: true,

        status: "USED",

        message: "Entry valid.",

        ticket: ticketResponse(checkedInTicket),
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

        message:
          error instanceof Error ? error.message : "Invalid scan request.",
      },
      {
        status: 500,
      },
    );
  }
}
