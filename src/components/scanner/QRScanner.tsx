"use client";

import "./scanner.css";

import { useCallback, useEffect, useRef, useState } from "react";

import Link from "next/link";

import { Html5Qrcode } from "html5-qrcode";

/* =========================================================
   TYPES
   ========================================================= */

type TicketResult = {
  ticketId: string;
  ticketType: string;
  date: string | null;
  venue: string;
  scannedAt: string | null;
};

type ScanResponse = {
  success: boolean;
  valid: boolean;
  status: "USED" | "INVALID" | "ERROR";
  message: string;
  ticket?: TicketResult;
};

/* =========================================================
   CONSTANTS
   ========================================================= */

const READER_ID = "qr-reader";

/* =========================================================
   HELPERS
   ========================================================= */

function isValidString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

/* =========================================================
   FORMAT DATE
   ========================================================= */

function formatDate(value: string | null | undefined): string {
  if (!value) {
    return "—";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Kolkata",
  }).format(date);
}

/* =========================================================
   FORMAT DATE + TIME
   ========================================================= */

function formatDateTime(value: string | null | undefined): string {
  if (!value) {
    return "—";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
    timeZone: "Asia/Kolkata",
  }).format(date);
}

/* =========================================================
   CAMERA ICON
   ========================================================= */

function CameraIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M7.5 7.5 9 5h6l1.5 2.5H20a1.5 1.5 0 0 1 1.5 1.5v8A1.5 1.5 0 0 1 20 18.5H4A1.5 1.5 0 0 1 2.5 17V9A1.5 1.5 0 0 1 4 7.5h3.5Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />

      <circle cx="12" cy="13" r="3.2" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

/* =========================================================
   ARROW ICON
   ========================================================= */

function ArrowIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M5 12h13m-6-6 6 6-6 6"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/* =========================================================
   CHECK ICON
   ========================================================= */

function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="m5 12.5 4.3 4.3L19 7"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/* =========================================================
   CLOSE ICON
   ========================================================= */

function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="m7 7 10 10M17 7 7 17"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

/* =========================================================
   QR SCANNER
   ========================================================= */

export default function QRScanner() {
  const scannerRef = useRef<Html5Qrcode | null>(null);

  const processingRef = useRef(false);

  const mountedRef = useRef(false);

  const [result, setResult] = useState<ScanResponse | null>(null);

  const [error, setError] = useState("");

  const [isScanning, setIsScanning] = useState(false);

  /* =======================================================
     STOP SCANNER
     ======================================================= */

  const stopScanner = useCallback(async () => {
    const scanner = scannerRef.current;

    if (!scanner) {
      setIsScanning(false);

      return;
    }

    try {
      if (scanner.isScanning) {
        await scanner.stop();
      }
    } catch {
      /*
       * Scanner may already be stopped.
       */
    }

    setIsScanning(false);
  }, []);

  /* =======================================================
     HANDLE QR CODE
     ======================================================= */

  const handleQRCode = useCallback(
    async (decodedText: string) => {
      if (processingRef.current) {
        return;
      }

      processingRef.current = true;

      /*
       * Stop camera immediately after
       * detecting a QR code.
       */

      await stopScanner();

      /*
       * IMPORTANT:
       *
       * The QR contains ONLY qr_token.
       *
       * Do NOT JSON.parse(decodedText).
       */

      const qrToken = decodedText.trim();

      if (!isValidString(qrToken)) {
        setResult({
          success: false,
          valid: false,
          status: "INVALID",
          message: "This QR code is not a valid EntryPass ticket.",
        });

        processingRef.current = false;

        return;
      }

      try {
        const response = await fetch("/api/tickets/scan", {
          method: "POST",

          headers: {
            "Content-Type": "application/json",
          },

          body: JSON.stringify({
            qrToken,
          }),
        });

        const data = (await response.json()) as ScanResponse;

        setResult(data);
      } catch (scanError) {
        console.error("Ticket scan error:", scanError);

        setResult({
          success: false,
          valid: false,
          status: "ERROR",
          message: "Unable to connect to the ticket server.",
        });
      } finally {
        processingRef.current = false;
      }
    },
    [stopScanner],
  );

  /* =======================================================
     START SCANNER
     ======================================================= */

  const startScanner = useCallback(async () => {
    if (isScanning || processingRef.current) {
      return;
    }

    setError("");

    try {
      const scanner = new Html5Qrcode(READER_ID);

      scannerRef.current = scanner;

      await scanner.start(
        {
          facingMode: "environment",
        },

        {
          fps: 10,

          qrbox: {
            width: 220,
            height: 220,
          },

          aspectRatio: 1,
        },

        (decodedText) => {
          void handleQRCode(decodedText);
        },

        () => {
          /*
           * Ignore normal QR
           * decode misses.
           */
        },
      );

      if (mountedRef.current) {
        setIsScanning(true);
      }
    } catch (scannerError) {
      console.error("Camera error:", scannerError);

      setError(
        "Camera access is unavailable. Allow camera permission and try again.",
      );

      setIsScanning(false);
    }
  }, [handleQRCode, isScanning]);

  /* =======================================================
     CLEANUP
     ======================================================= */

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;

      const scanner = scannerRef.current;

      if (scanner && scanner.isScanning) {
        void scanner.stop();
      }
    };
  }, []);

  /* =======================================================
     SCAN AGAIN
     ======================================================= */

  const scanAgain = async () => {
    await stopScanner();

    processingRef.current = false;

    setResult(null);

    setError("");

    window.setTimeout(() => {
      if (mountedRef.current) {
        void startScanner();
      }
    }, 100);
  };

  /* =======================================================
     RESULT STATES
     ======================================================= */

  const isValid = result?.success === true && result?.valid === true;

  const isUsed = result?.status === "USED" && !isValid;

  /* =======================================================
     UI
     ======================================================= */

  return (
    <main className="apple-scanner-page">
      {/* ===================================================
          HEADER
      =================================================== */}

      <header className="apple-scanner-nav">
        <Link
          href="/"
          className="apple-scanner-logo"
          aria-label="EntryPass home"
        >
          ENTRY<span>PASS</span>
        </Link>

        <nav className="apple-scanner-links" aria-label="Main navigation">
          <Link href="/admin/scanner" className="active">
            Scanner
          </Link>
        </nav>
      </header>

      {/* ===================================================
          SCANNER
      =================================================== */}

      {!result ? (
        <section className="apple-scanner-main">
          <div className="apple-scanner-heading">
            <div className="apple-scanner-eyebrow">EVENT ACCESS</div>

            <h1>
              Scan. Verify.
              <br />
              <span>Welcome in.</span>
            </h1>

            <p>Point the camera at the QR code on the attendee ticket.</p>
          </div>

          <div className="apple-camera-card">
            <div className="apple-camera-topline">
              <span>
                <CameraIcon />
                Camera
              </span>

              <span className={isScanning ? "camera-online" : ""}>
                <i />

                {isScanning ? "Camera active" : "Camera ready"}
              </span>
            </div>

            <div className="apple-camera-stage">
              <div id={READER_ID} />

              <div className="apple-scan-frame" aria-hidden="true">
                <span className="scan-corner tl" />
                <span className="scan-corner tr" />
                <span className="scan-corner bl" />
                <span className="scan-corner br" />

                {isScanning && <span className="apple-scan-line" />}
              </div>

              {!isScanning && !error && (
                <div className="apple-camera-placeholder">
                  <div className="apple-camera-icon">
                    <CameraIcon />
                  </div>

                  <strong>Camera is ready</strong>

                  <span>Start the scanner to activate your camera</span>
                </div>
              )}

              {error && (
                <div className="apple-camera-placeholder">
                  <div className="apple-camera-icon error">
                    <CloseIcon />
                  </div>

                  <strong>Camera unavailable</strong>

                  <span>{error}</span>
                </div>
              )}
            </div>

            {!isScanning && !error && (
              <button
                type="button"
                className="apple-start-button"
                onClick={() => void startScanner()}
              >
                Start camera
                <ArrowIcon />
              </button>
            )}

            {error && (
              <button
                type="button"
                className="apple-start-button"
                onClick={() => void startScanner()}
              >
                Try again
                <ArrowIcon />
              </button>
            )}

            {isScanning && (
              <div className="apple-scanning-note">
                <i />
                Scanning for a ticket
                <span>Gate 01</span>
              </div>
            )}
          </div>

          <div className="apple-scanner-note">
            <span>SECURE ENTRY</span>

            <span>Each ticket can only be accepted once.</span>
          </div>
        </section>
      ) : (
        /* =================================================
           RESULT
        ================================================= */

        <section className="apple-result-main">
          <div className={`apple-result-card ${isValid ? "valid" : "invalid"}`}>
            <div
              className={`apple-result-icon ${isValid ? "success" : "danger"}`}
            >
              {isValid ? <CheckIcon /> : <CloseIcon />}
            </div>

            <div className="apple-result-eyebrow">
              {isValid
                ? "TICKET VERIFIED"
                : isUsed
                  ? "SECURITY CHECK"
                  : "TICKET REJECTED"}
            </div>

            <h1>{isValid ? "Entry valid." : "Entry denied."}</h1>

            <p className="apple-result-message">
              {isValid
                ? "Ticket accepted. Entry has been recorded."
                : result.message}
            </p>

            {result.ticket && (
              <div className="apple-result-grid">
                <div>
                  <span>Ticket ID</span>

                  <strong>{result.ticket.ticketId}</strong>
                </div>

                <div>
                  <span>Ticket type</span>

                  <strong>{result.ticket.ticketType}</strong>
                </div>

                <div>
                  <span>Date</span>

                  <strong>{formatDate(result.ticket.date)}</strong>
                </div>

                <div>
                  <span>Venue</span>

                  <strong>{result.ticket.venue}</strong>
                </div>

                {/* =========================================
                    SCANNED AT
                ========================================= */}

                {result.ticket.scannedAt && (
                  <div>
                    <span>Scanned at</span>

                    <strong>{formatDateTime(result.ticket.scannedAt)}</strong>
                  </div>
                )}
              </div>
            )}

            <button
              type="button"
              className="apple-next-button"
              onClick={() => void scanAgain()}
            >
              Scan next ticket
              <ArrowIcon />
            </button>
          </div>
        </section>
      )}

      {/* ===================================================
          FOOTER
      =================================================== */}

      <footer className="apple-scanner-footer">
        <span>
          ENTRY<span>PASS</span>
        </span>

        <span>Made by, Anirudh Sonawane</span>
      </footer>
    </main>
  );
}
