import { NextRequest, NextResponse } from "next/server";
import QRCode from "qrcode";
import { PDFDocument, PDFPage, PDFFont, rgb, StandardFonts } from "pdf-lib";
import { randomUUID } from "crypto";

import { supabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";

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
   CONSTANTS
   ========================================================= */

const TABLES = {
  single: "single_tickets",
  couple: "couple_tickets",
} as const;

const VENUE_NAME = "GURUKUL OLYMPIAD SCHOOL";
const VENUE_ADDRESS = "BESIDES SHAHANOORWADI, BEED";
const EVENT_NAME = "NAV DURGA";
const EVENT_SUBTITLE = "RAAS DANDIYA 2026";

/* =========================================================
   HELPERS
   ========================================================= */

function getPrefix(type: TicketType) {
  return type === "couple" ? "CPL" : "SGL";
}

function getTicketLabel(type: TicketType) {
  return type === "couple" ? "Couple Entry" : "Single Entry";
}

function getTicketCode(prefix: string, number: number) {
  return `${prefix}-${String(number).padStart(4, "0")}`;
}

function parseCount(value: string | null) {
  if (!value) {
    return 0;
  }

  const count = Number(value);

  if (!Number.isInteger(count) || count < 0) {
    return 0;
  }

  return Math.min(count, 5000);
}

/* =========================================================
   GET EXISTING TICKETS
   ========================================================= */

async function getExistingTickets(type: TicketType) {
  const table = TABLES[type];
  const prefix = getPrefix(type);

  const { data, error } = await supabaseAdmin
    .from(table)
    .select("id, ticket_code, qr_token, status, created_at")
    .like("ticket_code", `${prefix}-%`)
    .order("ticket_code", {
      ascending: true,
    });

  if (error) {
    throw new Error(
      `Unable to read existing ${type} tickets: ${error.message}`,
    );
  }

  return (data ?? []).map((ticket) => ({
    ...ticket,
    ticket_type: type,
  })) as TicketRow[];
}

/* =========================================================
   FIND NEXT TICKET NUMBER
   ========================================================= */

function getNextTicketNumber(tickets: TicketRow[]) {
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
   ENSURE TICKETS EXIST
   ========================================================= */

async function ensureTickets(type: TicketType, requestedCount: number) {
  const existing = await getExistingTickets(type);

  /*
   * If enough tickets already exist,
   * reuse the existing tickets.
   */
  if (existing.length >= requestedCount) {
    return existing.slice(0, requestedCount);
  }

  const table = TABLES[type];
  const prefix = getPrefix(type);

  const missingCount = requestedCount - existing.length;
  const nextNumber = getNextTicketNumber(existing);

  const newTickets = Array.from(
    {
      length: missingCount,
    },
    (_, index) => {
      const number = nextNumber + index;

      return {
        ticket_code: getTicketCode(prefix, number),
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

  const createdTickets = (data ?? []).map((ticket) => ({
    ...ticket,
    ticket_type: type,
  })) as TicketRow[];

  return [...existing, ...createdTickets].slice(0, requestedCount);
}

/* =========================================================
   PDF TEXT HELPER
   ========================================================= */

function addText(
  page: PDFPage,
  font: PDFFont,
  text: string,
  x: number,
  y: number,
  size: number,
  color = rgb(0.1, 0.1, 0.1),
) {
  page.drawText(text, {
    x,
    y,
    size,
    font,
    color,
  });
}

/* =========================================================
   CREATE TICKET PAGE
   ========================================================= */

async function createTicketPage(
  pdf: PDFDocument,
  ticket: TicketRow,
  qrData: Uint8Array,
  regularFont: PDFFont,
  boldFont: PDFFont,
) {
  const page = pdf.addPage([595, 842]);

  const width = page.getWidth();
  const height = page.getHeight();

  const black = rgb(0.04, 0.04, 0.04);
  const gray = rgb(0.42, 0.42, 0.42);
  const lightGray = rgb(0.9, 0.9, 0.9);
  const lime = rgb(0.83, 0.97, 0.21);

  /* =======================================================
     BACKGROUND
     ======================================================= */

  page.drawRectangle({
    x: 0,
    y: 0,
    width,
    height,
    color: rgb(1, 1, 1),
  });

  /* =======================================================
     TOP ACCENT
     ======================================================= */

  page.drawRectangle({
    x: 0,
    y: height - 7,
    width,
    height: 7,
    color: lime,
  });

  /* =======================================================
     HEADER
     ======================================================= */

  addText(page, boldFont, "EVENT ENTRY PASS", 55, height - 70, 10, gray);

  addText(page, boldFont, EVENT_NAME, 55, height - 115, 28, black);

  addText(page, regularFont, EVENT_SUBTITLE, 55, height - 138, 11, gray);

  /* =======================================================
     VENUE
     ======================================================= */

  addText(page, boldFont, VENUE_NAME, 55, height - 190, 13, black);

  addText(page, regularFont, VENUE_ADDRESS, 55, height - 210, 9, gray);

  /* =======================================================
     QR CODE
     ======================================================= */

  const qrImage = await pdf.embedPng(qrData);

  const qrSize = 250;

  const qrX = (width - qrSize) / 2;
  const qrY = height - 480;

  page.drawImage(qrImage, {
    x: qrX,
    y: qrY,
    width: qrSize,
    height: qrSize,
  });

  /* =======================================================
     QR LABEL
     ======================================================= */

  const label = "SCAN TO VERIFY";

  const labelWidth = boldFont.widthOfTextAtSize(label, 9);

  addText(page, boldFont, label, (width - labelWidth) / 2, qrY - 25, 9, gray);

  /* =======================================================
     TICKET ID
     ======================================================= */

  addText(page, boldFont, "TICKET ID", 55, height - 535, 8, gray);

  addText(page, boldFont, ticket.ticket_code, 55, height - 560, 17, black);

  page.drawLine({
    start: {
      x: 55,
      y: height - 580,
    },
    end: {
      x: width - 55,
      y: height - 580,
    },
    thickness: 1,
    color: lightGray,
  });

  /* =======================================================
     TICKET TYPE
     ======================================================= */

  addText(page, boldFont, "TICKET TYPE", 55, height - 615, 8, gray);

  addText(
    page,
    boldFont,
    getTicketLabel(ticket.ticket_type).toUpperCase(),
    55,
    height - 640,
    13,
    black,
  );

  page.drawLine({
    start: {
      x: 55,
      y: height - 660,
    },
    end: {
      x: width - 55,
      y: height - 660,
    },
    thickness: 1,
    color: lightGray,
  });

  /* =======================================================
     VENUE DETAILS
     ======================================================= */

  addText(page, boldFont, "VENUE", 55, height - 695, 8, gray);

  addText(page, boldFont, VENUE_NAME, 55, height - 720, 12, black);

  addText(page, regularFont, VENUE_ADDRESS, 55, height - 740, 8, gray);

  /* =======================================================
     FOOTER
     ======================================================= */

  page.drawLine({
    start: {
      x: 55,
      y: 55,
    },
    end: {
      x: width - 55,
      y: 55,
    },
    thickness: 1,
    color: lightGray,
  });

  addText(
    page,
    regularFont,
    "Present this QR code at the event entrance.",
    55,
    35,
    7,
    gray,
  );
}

/* =========================================================
   GENERATE PDF
   ========================================================= */

async function generatePdf(tickets: TicketRow[]) {
  const pdf = await PDFDocument.create();

  const regularFont = await pdf.embedFont(StandardFonts.Helvetica);

  const boldFont = await pdf.embedFont(StandardFonts.HelveticaBold);

  for (const ticket of tickets) {
    /*
     * IMPORTANT:
     *
     * The QR code contains ONLY the random qr_token.
     *
     * Scanner sends this token to:
     *
     * POST /api/tickets/scan
     */

    const qrPayload = ticket.qr_token;

    const qrBuffer = await QRCode.toBuffer(qrPayload, {
      type: "png",
      width: 700,
      margin: 2,
      errorCorrectionLevel: "H",
    });

    await createTicketPage(pdf, ticket, qrBuffer, regularFont, boldFont);
  }

  return pdf.save();
}

/* =========================================================
   GET
   ========================================================= */

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    /*
     * Supported:
     *
     * ?single=100
     * ?couple=100
     * ?single=100&couple=100
     */

    const requestedSingle = parseCount(searchParams.get("single"));

    const requestedCouple = parseCount(searchParams.get("couple"));

    /*
     * BACKWARD COMPATIBILITY
     *
     * ?type=single&count=100
     * ?type=couple&count=100
     */

    const legacyCount = parseCount(searchParams.get("count"));

    const legacyType =
      searchParams.get("type") === "couple" ? "couple" : "single";

    let singleCount = requestedSingle;
    let coupleCount = requestedCouple;

    if (
      !searchParams.has("single") &&
      !searchParams.has("couple") &&
      legacyCount > 0
    ) {
      if (legacyType === "single") {
        singleCount = legacyCount;
      } else {
        coupleCount = legacyCount;
      }
    }

    /* =====================================================
       VALIDATE REQUEST
       ===================================================== */

    if (singleCount <= 0 && coupleCount <= 0) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Provide at least one ticket count. Example: ?single=100&couple=100",
        },
        {
          status: 400,
        },
      );
    }

    /* =====================================================
       PREPARE SINGLE TICKETS
       ===================================================== */

    let singleTickets: TicketRow[] = [];

    if (singleCount > 0) {
      singleTickets = await ensureTickets("single", singleCount);
    }

    /* =====================================================
       PREPARE COUPLE TICKETS
       ===================================================== */

    let coupleTickets: TicketRow[] = [];

    if (coupleCount > 0) {
      coupleTickets = await ensureTickets("couple", coupleCount);
    }

    /* =====================================================
       VALIDATION
       ===================================================== */

    if (singleTickets.length < singleCount) {
      return NextResponse.json(
        {
          success: false,
          message: "Unable to prepare the requested Single tickets.",
          requested: singleCount,
          available: singleTickets.length,
        },
        {
          status: 500,
        },
      );
    }

    if (coupleTickets.length < coupleCount) {
      return NextResponse.json(
        {
          success: false,
          message: "Unable to prepare the requested Couple tickets.",
          requested: coupleCount,
          available: coupleTickets.length,
        },
        {
          status: 500,
        },
      );
    }

    /* =====================================================
       COMBINE TICKETS
       ===================================================== */

    const tickets = [...singleTickets, ...coupleTickets];

    /* =====================================================
       GENERATE PDF
       ===================================================== */

    const pdfBytes = await generatePdf(tickets);

    const pdfBuffer = Buffer.from(pdfBytes);

    /* =====================================================
       FILE NAME
       ===================================================== */

    let filename = "entrypass-tickets.pdf";

    if (singleCount > 0 && coupleCount > 0) {
      filename = `entrypass-single-${singleCount}-couple-${coupleCount}.pdf`;
    } else if (singleCount > 0) {
      filename = `entrypass-single-${singleCount}.pdf`;
    } else if (coupleCount > 0) {
      filename = `entrypass-couple-${coupleCount}.pdf`;
    }

    /* =====================================================
       DOWNLOAD RESPONSE
       ===================================================== */

    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",

        "Content-Disposition": `attachment; filename="${filename}"`,

        "Cache-Control":
          "no-store, no-cache, must-revalidate, proxy-revalidate",

        Pragma: "no-cache",

        Expires: "0",
      },
    });
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
