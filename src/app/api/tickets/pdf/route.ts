import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";

import QRCode from "qrcode";

import { PDFDocument, PDFPage, PDFFont, rgb, StandardFonts } from "pdf-lib";

import { supabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";

/* =========================================================
   TYPES
   ========================================================= */

type TicketType = "single" | "couple";

type TicketRow = {
  id: string;
  ticket_code: string;
  qr_token: string;
  status: string;
  created_at?: string;
  ticket_type: TicketType;
};

/* =========================================================
   PDF SETTINGS
   ========================================================= */

const PAGE_WIDTH = 595;
const PAGE_HEIGHT = 842;

/*
 * A4 PORTRAIT
 *
 * 4 columns × 3 rows
 *
 * TOTAL:
 * 12 tickets per page
 */
const COLUMNS = 4;
const ROWS = 3;

const TICKETS_PER_PAGE = COLUMNS * ROWS;

/*
 * A4 margins
 */
const MARGIN_X = 18;
const MARGIN_Y = 18;

/*
 * Space between tickets
 */
const GAP_X = 7;
const GAP_Y = 10;

/*
 * Calculate card size automatically.
 *
 * This makes the layout fit exactly
 * inside the A4 page.
 */
const CARD_WIDTH =
  (PAGE_WIDTH - MARGIN_X * 2 - GAP_X * (COLUMNS - 1)) / COLUMNS;

const CARD_HEIGHT = (PAGE_HEIGHT - MARGIN_Y * 2 - GAP_Y * (ROWS - 1)) / ROWS;

/*
 * Grid dimensions
 */
const GRID_WIDTH = COLUMNS * CARD_WIDTH + (COLUMNS - 1) * GAP_X;

const GRID_HEIGHT = ROWS * CARD_HEIGHT + (ROWS - 1) * GAP_Y;

/*
 * Center the complete grid
 * horizontally and vertically.
 */
const GRID_START_X = (PAGE_WIDTH - GRID_WIDTH) / 2;

const GRID_START_Y = PAGE_HEIGHT - (PAGE_HEIGHT - GRID_HEIGHT) / 2;

/* =========================================================
   TYPE HELPERS
   ========================================================= */

function getTableName(type: TicketType): "single_tickets" | "couple_tickets" {
  if (type === "couple") {
    return "couple_tickets";
  }

  return "single_tickets";
}

function getPrefix(type: TicketType): string {
  if (type === "couple") {
    return "CPL";
  }

  return "SGL";
}

function getTicketLabel(type: TicketType): string {
  if (type === "couple") {
    return "Couple";
  }

  return "Single";
}

function getTicketCode(type: TicketType, number: number): string {
  const prefix = getPrefix(type);

  return `${prefix}-${String(number).padStart(4, "0")}`;
}

/* =========================================================
   COUNT PARSER
   ========================================================= */

function parseCount(value: string | null): number {
  if (!value) {
    return 0;
  }

  const count = Number(value);

  if (!Number.isInteger(count)) {
    return 0;
  }

  if (count < 1) {
    return 0;
  }

  /*
   * Safety limit.
   */
  return Math.min(count, 5000);
}

/* =========================================================
   GET EXISTING TICKETS
   ========================================================= */

async function getExistingTickets(type: TicketType): Promise<TicketRow[]> {
  const table = getTableName(type);

  const prefix = getPrefix(type);

  const { data, error } = await supabaseAdmin
    .from(table)
    .select("id, ticket_code, qr_token, status, created_at")
    .like("ticket_code", `${prefix}-%`)
    .order("ticket_code", {
      ascending: true,
    });

  if (error) {
    throw new Error(`Unable to read ${type} tickets: ${error.message}`);
  }

  return (data ?? []).map((ticket) => ({
    ...ticket,
    ticket_type: type,
  })) as TicketRow[];
}

/* =========================================================
   FIND NEXT TICKET NUMBER
   ========================================================= */

function getNextTicketNumber(tickets: TicketRow[]): number {
  let highest = 0;

  for (const ticket of tickets) {
    const match = ticket.ticket_code.match(/(\d+)$/);

    if (!match) {
      continue;
    }

    const number = Number(match[1]);

    if (Number.isFinite(number)) {
      highest = Math.max(highest, number);
    }
  }

  return highest + 1;
}

/* =========================================================
   ENSURE REQUESTED TICKETS EXIST
   ========================================================= */

async function ensureTickets(
  type: TicketType,
  requestedCount: number,
): Promise<TicketRow[]> {
  const existing = await getExistingTickets(type);

  /*
   * If enough tickets already exist,
   * reuse them.
   *
   * This prevents duplicate tickets
   * when the PDF URL is opened again.
   */
  if (existing.length >= requestedCount) {
    return existing.slice(0, requestedCount);
  }

  const table = getTableName(type);

  const missingCount = requestedCount - existing.length;

  const nextNumber = getNextTicketNumber(existing);

  const newTickets = Array.from(
    {
      length: missingCount,
    },
    (_, index) => {
      const number = nextNumber + index;

      return {
        ticket_code: getTicketCode(type, number),

        qr_token: randomUUID(),

        status: "UNUSED",
      };
    },
  );

  const { data, error } = await supabaseAdmin
    .from(table)
    .insert(newTickets)
    .select("id, ticket_code, qr_token, status, created_at");

  if (error) {
    throw new Error(`Unable to create ${type} tickets: ${error.message}`);
  }

  const created = (data ?? []).map((ticket) => ({
    ...ticket,
    ticket_type: type,
  })) as TicketRow[];

  return [...existing, ...created].slice(0, requestedCount);
}

/* =========================================================
   TEXT DRAWING
   ========================================================= */

function drawText(
  page: PDFPage,
  font: PDFFont,
  text: string,
  x: number,
  y: number,
  size: number,
  color = rgb(0.05, 0.05, 0.05),
): void {
  page.drawText(text, {
    x,
    y,
    size,
    font,
    color,
  });
}

/* =========================================================
   CENTERED TEXT
   ========================================================= */

function drawCenteredText(
  page: PDFPage,
  font: PDFFont,
  text: string,
  centerX: number,
  y: number,
  size: number,
  color = rgb(0.05, 0.05, 0.05),
): void {
  const textWidth = font.widthOfTextAtSize(text, size);

  const x = centerX - textWidth / 2;

  drawText(page, font, text, x, y, size, color);
}

/* =========================================================
   GET GUEST NUMBER
   ========================================================= */

function getGuestNumber(ticket: TicketRow): string {
  const match = ticket.ticket_code.match(/(\d+)$/);

  if (!match) {
    return "0";
  }

  return String(Number(match[1]));
}

/* =========================================================
   DRAW ONE TICKET
   ========================================================= */

async function drawTicketCard(
  pdf: PDFDocument,
  page: PDFPage,
  ticket: TicketRow,
  qrData: Uint8Array,
  regularFont: PDFFont,
  boldFont: PDFFont,
  x: number,
  y: number,
): Promise<void> {
  const borderColor = rgb(0.78, 0.78, 0.78);

  const darkColor = rgb(0.02, 0.08, 0.12);

  const navyColor = rgb(0.03, 0.16, 0.28);

  const grayColor = rgb(0.3, 0.3, 0.3);

  const whiteColor = rgb(1, 1, 1);

  /* =======================================================
     CARD
     ======================================================= */

  page.drawRectangle({
    x,
    y,
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    color: whiteColor,
    borderColor,
    borderWidth: 0.8,
  });

  /* =======================================================
     QR CODE
     ======================================================= */

  const qrImage = await pdf.embedPng(qrData);

  /*
   * Scale QR dynamically based
   * on the new 4-column layout.
   *
   * Card width is approximately
   * 135 points, so 108 gives
   * comfortable margins.
   */
  const qrSize = Math.min(108, CARD_WIDTH - 20);

  const qrX = x + (CARD_WIDTH - qrSize) / 2;

  const qrY = y + CARD_HEIGHT - qrSize - 34;

  page.drawImage(qrImage, {
    x: qrX,
    y: qrY,
    width: qrSize,
    height: qrSize,
  });

  /* =======================================================
     GUEST NUMBER
     ======================================================= */

  const guestNumber = getGuestNumber(ticket);

  drawCenteredText(
    page,
    boldFont,
    `GUEST ${guestNumber}`,
    x + CARD_WIDTH / 2,
    y + 25,
    9,
    navyColor,
  );

  /* =======================================================
     GUEST LIST
     ======================================================= */

  drawCenteredText(
    page,
    regularFont,
    "Guest List",
    x + CARD_WIDTH / 2,
    y + 13,
    7.5,
    darkColor,
  );

  /* =======================================================
     TICKET TYPE
     ======================================================= */

  drawCenteredText(
    page,
    regularFont,
    getTicketLabel(ticket.ticket_type),
    x + CARD_WIDTH / 2,
    y + 3,
    6.5,
    grayColor,
  );
}

/* =========================================================
   GENERATE PDF
   ========================================================= */

async function generatePdf(tickets: TicketRow[]): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();

  const regularFont = await pdf.embedFont(StandardFonts.Helvetica);

  const boldFont = await pdf.embedFont(StandardFonts.HelveticaBold);

  /*
   * Reverse the tickets so:
   *
   * GUEST 100
   * GUEST 99
   * GUEST 98
   *
   * appear first.
   */
  const orderedTickets = [...tickets].reverse();

  for (let index = 0; index < orderedTickets.length; index++) {
    /*
     * Add a new A4 page
     * every 12 tickets.
     */
    if (index % TICKETS_PER_PAGE === 0) {
      pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    }

    const pages = pdf.getPages();

    const page = pages[pages.length - 1];

    const position = index % TICKETS_PER_PAGE;

    /*
     * 4 columns.
     */
    const row = Math.floor(position / COLUMNS);

    const column = position % COLUMNS;

    /*
     * Calculate exact position.
     */
    const x = GRID_START_X + column * (CARD_WIDTH + GAP_X);

    const y = GRID_START_Y - CARD_HEIGHT - row * (CARD_HEIGHT + GAP_Y);

    const ticket = orderedTickets[index];

    /* =====================================================
       QR DATA
       ===================================================== */

    /*
     * IMPORTANT:
     *
     * QR contains ONLY qr_token.
     *
     * No ticket code.
     * No guest name.
     * No other information.
     */
    const qrBuffer = await QRCode.toBuffer(ticket.qr_token, {
      type: "png",
      width: 600,
      margin: 1,
      errorCorrectionLevel: "H",
    });

    await drawTicketCard(
      pdf,
      page,
      ticket,
      qrBuffer,
      regularFont,
      boldFont,
      x,
      y,
    );
  }

  return pdf.save();
}

/* =========================================================
   PDF RESPONSE
   ========================================================= */

function createPdfResponse(pdf: Uint8Array, filename: string): NextResponse {
  const buffer = Buffer.from(pdf);

  return new NextResponse(buffer, {
    status: 200,

    headers: {
      "Content-Type": "application/pdf",

      /*
       * Force download.
       */
      "Content-Disposition": `attachment; filename="${filename}"`,

      /*
       * Never cache generated
       * ticket PDFs.
       */
      "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",

      Pragma: "no-cache",

      Expires: "0",
    },
  });
}

/* =========================================================
   GENERATE ONE TYPE
   ========================================================= */

async function generateTicketResponse(
  type: TicketType,
  count: number,
): Promise<NextResponse> {
  if (count <= 0) {
    return NextResponse.json(
      {
        success: false,
        message: "Invalid ticket count.",
      },
      {
        status: 400,
      },
    );
  }

  const tickets = await ensureTickets(type, count);

  if (tickets.length < count) {
    return NextResponse.json(
      {
        success: false,
        message: `Unable to prepare ${count} ${type} tickets.`,
        requested: count,
        available: tickets.length,
      },
      {
        status: 500,
      },
    );
  }

  console.log(`[TICKET PDF] Generating ${count} ${type} tickets`);

  const pdf = await generatePdf(tickets);

  const filename = `entrypass-${type}-${count}.pdf`;

  return createPdfResponse(pdf, filename);
}

/* =========================================================
   GET
   ========================================================= */

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(request.url);

    /* =====================================================
       SINGLE
       ===================================================== */

    const singleCount = parseCount(searchParams.get("single"));

    /* =====================================================
       COUPLE
       ===================================================== */

    const coupleCount = parseCount(searchParams.get("couple"));

    /* =====================================================
       LEGACY FORMAT
       ===================================================== */

    /*
     * Also supports:
     *
     * ?type=single&count=100
     *
     * ?type=couple&count=100
     */
    if (singleCount === 0 && coupleCount === 0 && searchParams.has("type")) {
      const legacyType = searchParams.get("type");

      const legacyCount = parseCount(searchParams.get("count"));

      if (legacyType === "single") {
        return generateTicketResponse("single", legacyCount);
      }

      if (legacyType === "couple") {
        return generateTicketResponse("couple", legacyCount);
      }
    }

    /* =====================================================
       BOTH TYPES
       ===================================================== */

    if (singleCount > 0 && coupleCount > 0) {
      const singleTickets = await ensureTickets("single", singleCount);

      const coupleTickets = await ensureTickets("couple", coupleCount);

      const tickets = [...singleTickets, ...coupleTickets];

      const pdf = await generatePdf(tickets);

      const filename = `entrypass-single-${singleCount}-couple-${coupleCount}.pdf`;

      return createPdfResponse(pdf, filename);
    }

    /* =====================================================
       SINGLE ONLY
       ===================================================== */

    if (singleCount > 0) {
      return generateTicketResponse("single", singleCount);
    }

    /* =====================================================
       COUPLE ONLY
       ===================================================== */

    if (coupleCount > 0) {
      return generateTicketResponse("couple", coupleCount);
    }

    /* =====================================================
       INVALID REQUEST
       ===================================================== */

    return NextResponse.json(
      {
        success: false,
        message: "Provide a ticket count. Example: ?single=100 or ?couple=100",
      },
      {
        status: 400,
      },
    );
  } catch (error) {
    console.error("[TICKET PDF] Generation failed:", error);

    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : "Unable to generate ticket PDF.",
      },
      {
        status: 500,
      },
    );
  }
}
