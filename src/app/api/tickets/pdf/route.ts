import { NextRequest } from "next/server";
import QRCode from "qrcode";

import {
  PDFDocument,
  PDFPage,
  PDFFont,
  RGB,
  rgb,
  StandardFonts,
} from "pdf-lib";

import { supabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";

type TicketType = "single" | "couple";

type Ticket = {
  id: string;
  ticket_code: string;
  ticket_type: string;
  qr_token: string;
  status: string;
};

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;

const QR_SIZE = 360;
const QR_Y = 300;
const CODE_Y = 265;
const CODE_FONT_SIZE = 13;

export async function GET(request: NextRequest): Promise<Response> {
  try {
    const { searchParams } = new URL(request.url);

    const typeParam = searchParams.get("type");

    if (typeParam !== "single" && typeParam !== "couple") {
      return Response.json(
        {
          success: false,
          error: "type must be single or couple",
        },
        {
          status: 400,
        },
      );
    }

    const type: TicketType = typeParam;

    const countParam = searchParams.get("count") ?? "10";

    const requestedCount = Number(countParam);

    if (
      !Number.isInteger(requestedCount) ||
      requestedCount < 1 ||
      requestedCount > 5000
    ) {
      return Response.json(
        {
          success: false,
          error: "count must be between 1 and 5000",
        },
        {
          status: 400,
        },
      );
    }

    const databaseType = type === "single" ? "SINGLE" : "COUPLE";

    /*
     * Fetch the actual tickets from Supabase.
     *
     * The ticket code and QR token are never
     * generated locally. They always come from
     * the production database.
     */
    const { data, error } = await supabaseAdmin
      .from("tickets")
      .select(
        `
            id,
            ticket_code,
            ticket_type,
            qr_token,
            status
          `,
      )
      .eq("ticket_type", databaseType)
      .order("ticket_code", {
        ascending: true,
      })
      .limit(requestedCount);

    if (error) {
      console.error("Supabase ticket fetch error:", error);

      return Response.json(
        {
          success: false,
          error: "Failed to fetch tickets from database",
        },
        {
          status: 500,
        },
      );
    }

    const tickets = (data ?? []) as Ticket[];

    if (tickets.length === 0) {
      return Response.json(
        {
          success: false,
          error: `No ${databaseType} tickets found`,
        },
        {
          status: 404,
        },
      );
    }

    /*
     * Never silently generate fewer tickets
     * than requested.
     */
    if (tickets.length !== requestedCount) {
      return Response.json(
        {
          success: false,
          error: `Requested ${requestedCount} tickets but only ${tickets.length} ${databaseType} tickets exist`,
        },
        {
          status: 409,
        },
      );
    }

    const pdf = await PDFDocument.create();

    const boldFont = await pdf.embedFont(StandardFonts.HelveticaBold);

    const typeLabel = type === "single" ? "Single" : "Couple";

    /*
     * Create one A4 page per ticket.
     */
    for (const ticket of tickets) {
      const page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);

      /*
       * The QR contains:
       *
       * {
       *   ticketCode: "ND-S-000002",
       *   token: "64-character-secure-token"
       * }
       *
       * The scanner will later use both values
       * to authenticate the ticket.
       */
      const qrPayload = JSON.stringify({
        ticketCode: ticket.ticket_code,

        token: ticket.qr_token,
      });

      const qrDataUrl = await QRCode.toDataURL(qrPayload, {
        errorCorrectionLevel: "H",

        margin: 1,

        width: 1200,
      });

      const base64 = qrDataUrl.replace(/^data:image\/png;base64,/, "");

      const qrBytes = Buffer.from(base64, "base64");

      const qrImage = await pdf.embedPng(qrBytes);

      /*
       * Pure white A4 background.
       */
      page.drawRectangle({
        x: 0,
        y: 0,
        width: PAGE_WIDTH,
        height: PAGE_HEIGHT,
        color: rgb(1, 1, 1),
      });

      /*
       * Large centered QR.
       */
      page.drawImage(qrImage, {
        x: (PAGE_WIDTH - QR_SIZE) / 2,

        y: QR_Y,

        width: QR_SIZE,

        height: QR_SIZE,
      });

      /*
       * Only visible text below the QR.
       *
       * Example:
       *
       * ND-S-000002 - Single
       * ND-C-000001 - Couple
       */
      const displayCode = `${ticket.ticket_code} - ${typeLabel}`;

      drawCenteredText(
        page,
        displayCode,
        PAGE_WIDTH / 2,
        CODE_Y,
        CODE_FONT_SIZE,
        boldFont,
        rgb(0.08, 0.08, 0.08),
      );
    }

    const pdfBytes = await pdf.save();

    const filename =
      type === "single"
        ? `single-tickets-${requestedCount}.pdf`
        : `couple-tickets-${requestedCount}.pdf`;

    return new Response(Buffer.from(pdfBytes), {
      status: 200,

      headers: {
        "Content-Type": "application/pdf",

        "Content-Disposition": `attachment; filename="${filename}"`,

        "Cache-Control": "no-store, no-cache, must-revalidate",

        Pragma: "no-cache",
      },
    });
  } catch (error) {
    console.error("PDF generation error:", error);

    return Response.json(
      {
        success: false,
        error: "Failed to generate PDF",
      },
      {
        status: 500,
      },
    );
  }
}

/**
 * Draw centered text on a PDF page.
 */
function drawCenteredText(
  page: PDFPage,
  text: string,
  centerX: number,
  y: number,
  size: number,
  font: PDFFont,
  color: RGB,
): void {
  const textWidth = font.widthOfTextAtSize(text, size);

  page.drawText(text, {
    x: centerX - textWidth / 2,

    y,

    size,

    font,

    color,
  });
}
