import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import QRCode from "qrcode";

import { PDFDocument, PDFPage, PDFFont, rgb, StandardFonts } from "pdf-lib";

import { supabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";

type TicketType = "single" | "couple";

type TicketRow = {
  id: string;
  ticket_code: string;
  ticket_type: string;
  qr_token: string;
  status: string;
  created_at: string;
};

type GenerateResult = {
  tickets: TicketRow[];
  created: number;
  reused: number;
};

function normalizeTicketType(value: string | null): TicketType {
  return value === "couple" ? "couple" : "single";
}

function getPrefix(type: TicketType) {
  return type === "couple" ? "CPL" : "SGL";
}

function getTicketCode(prefix: string, number: number) {
  return `${prefix}-${String(number).padStart(4, "0")}`;
}

/**
 * Gets the highest existing ticket number for the requested type.
 *
 * Example:
 * SGL-0001
 * SGL-0002
 * SGL-0150
 *
 * returns 150.
 */
function extractTicketNumber(ticketCode: string, prefix: string): number {
  const match = ticketCode.match(new RegExp(`^${prefix}-(\\d+)$`));

  if (!match) {
    return 0;
  }

  return Number(match[1]);
}

/**
 * Fetch existing tickets for this ticket type.
 */
async function getExistingTickets(type: TicketType): Promise<TicketRow[]> {
  const ticketType = type.toUpperCase();

  const { data, error } = await supabaseAdmin
    .from("tickets")
    .select("id, ticket_code, ticket_type, qr_token, status, created_at")
    .eq("ticket_type", ticketType)
    .order("ticket_code", {
      ascending: true,
    });

  if (error) {
    throw new Error(`Unable to fetch existing tickets: ${error.message}`);
  }

  return (data ?? []) as TicketRow[];
}

/**
 * Creates enough tickets to satisfy requestedCount.
 *
 * IMPORTANT:
 * Existing tickets are reused.
 *
 * Example:
 *
 * Existing = 100
 * Requested = 500
 *
 * Creates only 400 new tickets.
 *
 * Next request:
 *
 * Existing = 500
 * Requested = 500
 *
 * Creates 0 new tickets.
 */
async function ensureTickets(
  type: TicketType,
  requestedCount: number,
): Promise<GenerateResult> {
  const prefix = getPrefix(type);

  const existing = await getExistingTickets(type);

  if (existing.length >= requestedCount) {
    return {
      tickets: existing.slice(0, requestedCount),
      created: 0,
      reused: requestedCount,
    };
  }

  const missingCount = requestedCount - existing.length;

  let highestNumber = 0;

  for (const ticket of existing) {
    const number = extractTicketNumber(ticket.ticket_code, prefix);

    if (number > highestNumber) {
      highestNumber = number;
    }
  }

  const newTickets = Array.from({ length: missingCount }, (_, index) => {
    const ticketNumber = highestNumber + index + 1;

    return {
      ticket_code: getTicketCode(prefix, ticketNumber),

      ticket_type: type.toUpperCase(),

      /**
       * IMPORTANT:
       * qr_token is the secret value encoded
       * into the QR code.
       */
      qr_token: randomUUID(),

      status: "UNUSED",
    };
  });

  const { data, error } = await supabaseAdmin
    .from("tickets")
    .insert(newTickets)
    .select("id, ticket_code, ticket_type, qr_token, status, created_at");

  if (error) {
    throw new Error(`Unable to create tickets: ${error.message}`);
  }

  const createdTickets = (data ?? []) as TicketRow[];

  return {
    tickets: [...existing, ...createdTickets].slice(0, requestedCount),
    created: createdTickets.length,
    reused: existing.length,
  };
}

/**
 * Draws a centered string on a PDF page.
 */
function drawCenteredText(
  page: PDFPage,
  text: string,
  y: number,
  font: PDFFont,
  size: number,
) {
  const width = font.widthOfTextAtSize(text, size);

  page.drawText(text, {
    x: (page.getWidth() - width) / 2,
    y,
    size,
    font,
    color: rgb(0.08, 0.08, 0.08),
  });
}

/**
 * Draw QR code PNG on PDF page.
 */
async function drawQRCode(page: PDFPage, pdf: PDFDocument, qrToken: string) {
  const qrDataUrl = await QRCode.toDataURL(qrToken, {
    errorCorrectionLevel: "H",
    margin: 2,
    width: 800,
  });

  const base64 = qrDataUrl.split(",")[1];

  if (!base64) {
    throw new Error("Unable to generate QR code image.");
  }

  const qrBytes = Buffer.from(base64, "base64");

  const qrImage = await pdf.embedPng(qrBytes);

  const qrSize = 230;

  page.drawImage(qrImage, {
    x: (page.getWidth() - qrSize) / 2,
    y: 190,
    width: qrSize,
    height: qrSize,
  });
}

/**
 * Draw one ticket page.
 */
async function drawTicketPage(
  pdf: PDFDocument,
  ticket: TicketRow,
  regularFont: PDFFont,
  boldFont: PDFFont,
) {
  const page = pdf.addPage([595.28, 841.89]);

  const width = page.getWidth();
  const height = page.getHeight();

  /**
   * Outer border
   */
  page.drawRectangle({
    x: 25,
    y: 25,
    width: width - 50,
    height: height - 50,
    borderWidth: 1.5,
    borderColor: rgb(0.12, 0.12, 0.12),
  });

  /**
   * Header
   */
  drawCenteredText(page, "ENTRY PASS", height - 75, boldFont, 28);

  drawCenteredText(page, ticket.ticket_type, height - 105, regularFont, 11);

  /**
   * Divider
   */
  page.drawLine({
    start: {
      x: 60,
      y: height - 130,
    },
    end: {
      x: width - 60,
      y: height - 130,
    },
    thickness: 1,
    color: rgb(0.75, 0.75, 0.75),
  });

  /**
   * Ticket code
   */
  drawCenteredText(page, ticket.ticket_code, height - 175, boldFont, 24);

  drawCenteredText(page, "SCAN THIS QR CODE AT ENTRY", 165, regularFont, 10);

  /**
   * QR code
   *
   * IMPORTANT:
   * The QR contains qr_token, NOT the
   * human-readable ticket code.
   */
  await drawQRCode(page, pdf, ticket.qr_token);

  /**
   * Footer
   */
  drawCenteredText(
    page,
    "Valid entry pass • One-time verification",
    85,
    regularFont,
    9,
  );

  drawCenteredText(page, ticket.ticket_code, 60, regularFont, 9);
}

/**
 * GET /api/tickets/pdf?type=single&count=500
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    const type = normalizeTicketType(searchParams.get("type"));

    const countValue = searchParams.get("count") ?? "1";

    const count = Number(countValue);

    if (!Number.isInteger(count) || count < 1 || count > 5000) {
      return NextResponse.json(
        {
          success: false,
          error: "Count must be an integer between 1 and 5000.",
        },
        {
          status: 400,
        },
      );
    }

    console.log(`[PDF] Preparing ${count} ${type} tickets`);

    /**
     * Reuse existing tickets whenever possible.
     */
    const result = await ensureTickets(type, count);

    console.log(`[PDF] Tickets ready: ${result.tickets.length}`);

    console.log(`[PDF] Created: ${result.created}`);

    console.log(`[PDF] Reused: ${result.reused}`);

    /**
     * Make sure every ticket has a QR token.
     */
    const invalidTicket = result.tickets.find(
      (ticket) => !ticket.qr_token || ticket.qr_token.trim().length === 0,
    );

    if (invalidTicket) {
      throw new Error(
        `Ticket ${invalidTicket.ticket_code} does not have a valid qr_token.`,
      );
    }

    /**
     * Create PDF.
     */
    const pdf = await PDFDocument.create();

    const regularFont = await pdf.embedFont(StandardFonts.Helvetica);

    const boldFont = await pdf.embedFont(StandardFonts.HelveticaBold);

    /**
     * One ticket = one PDF page.
     */
    for (const ticket of result.tickets) {
      await drawTicketPage(pdf, ticket, regularFont, boldFont);
    }

    const pdfBytes = await pdf.save();

    /**
     * IMPORTANT FIX:
     *
     * pdf-lib returns Uint8Array.
     * NextResponse in the current Next.js/
     * TypeScript setup does not accept that
     * type directly.
     *
     * Convert it to a Node Buffer first.
     */
    const pdfBuffer = Buffer.from(pdfBytes);

    console.log(`[PDF] Generated ${result.tickets.length} pages`);

    return new NextResponse(pdfBuffer, {
      status: 200,

      headers: {
        "Content-Type": "application/pdf",

        "Content-Disposition": `attachment; filename="${type}-tickets-${count}.pdf"`,

        "Content-Length": String(pdfBuffer.length),

        "Cache-Control": "no-store, no-cache, must-revalidate",

        Pragma: "no-cache",
      },
    });
  } catch (error) {
    console.error("[PDF] Ticket generation failed:", error);

    const message =
      error instanceof Error
        ? error.message
        : "Unknown error while generating PDF.";

    return NextResponse.json(
      {
        success: false,
        error: message,
      },
      {
        status: 500,
      },
    );
  }
}
