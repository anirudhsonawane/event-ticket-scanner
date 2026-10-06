"use client";

import "./scanner.css";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Html5Qrcode } from "html5-qrcode";

type TicketResult = {
  ticketId: string;
  ticketType: string;
  date: string | null;
  venue: string;
  checkInTime: string | null;
  gate: string | null;
};

type ScanResponse = {
  success: boolean;
  valid: boolean;
  status: "USED" | "INVALID" | "ERROR";
  message: string;
  ticket?: TicketResult;
};

type QRPayload = {
  ticketCode?: unknown;
  token?: unknown;
};

const READER_ID = "qr-reader";
const GATE = "Gate 1";

function isValidString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function formatDate(value: string | null | undefined): string {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "—";

  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Kolkata",
  }).format(date);
}

function formatDateTime(value: string | null | undefined): string {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "—";

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

export default function QRScanner() {
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const processingRef = useRef(false);
  const mountedRef = useRef(false);

  const [result, setResult] = useState<ScanResponse | null>(null);
  const [error, setError] = useState("");
  const [isScanning, setIsScanning] = useState(false);

  const stopScanner = useCallback(async () => {
    const scanner = scannerRef.current;

    if (!scanner) return;

    try {
      if (scanner.isScanning) {
        await scanner.stop();
      }
    } catch {
      // Scanner may already be stopped.
    }

    setIsScanning(false);
  }, []);

  const handleQRCode = useCallback(
    async (decodedText: string) => {
      if (processingRef.current) return;

      processingRef.current = true;

      await stopScanner();

      let qrData: QRPayload;

      try {
        qrData = JSON.parse(decodedText) as QRPayload;
      } catch {
        setResult({
          success: false,
          valid: false,
          status: "INVALID",
          message: "This QR code is not a valid EntryPass ticket.",
        });

        processingRef.current = false;
        return;
      }

      const ticketCode = isValidString(qrData.ticketCode)
        ? qrData.ticketCode.trim()
        : "";

      const token = isValidString(qrData.token) ? qrData.token.trim() : "";

      if (!ticketCode || !token) {
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
            ticketCode,
            token,
            gate: GATE,
            scannedBy: "ADMIN_SCANNER",
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

  const startScanner = useCallback(async () => {
    if (isScanning || processingRef.current) return;

    setError("");

    try {
      const scanner = new Html5Qrcode(READER_ID);
      scannerRef.current = scanner;

      await scanner.start(
        { facingMode: "environment" },
        {
          fps: 10,
          qrbox: { width: 280, height: 280 },
        },
        (decodedText) => {
          void handleQRCode(decodedText);
        },
        () => {},
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

  const isValid = result?.success === true && result?.valid === true;
  const isUsed = result?.status === "USED";

  return (
    <main className="apple-scanner-page">
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
          <Link href="/admin/tickets">Tickets</Link>
        </nav>
      </header>

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

                {isUsed && result.ticket.checkInTime && (
                  <div>
                    <span>Checked in</span>
                    <strong>{formatDateTime(result.ticket.checkInTime)}</strong>
                  </div>
                )}

                {isUsed && result.ticket.gate && (
                  <div>
                    <span>Gate</span>
                    <strong>{result.ticket.gate}</strong>
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

      <footer className="apple-scanner-footer">
        <span>
          ENTRY<span>PASS</span>
        </span>
        <span>Made by, Anirudh Sonawane</span>
      </footer>
    </main>
  );
}
