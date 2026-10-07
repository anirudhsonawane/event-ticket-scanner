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
  scannedAt: string | null;
};

type ScanResponse = {
  success: boolean;
  valid: boolean;
  status: "USED" | "INVALID" | "ERROR";
  message: string;
  ticket?: TicketResult;
};

const READER_ID = "qr-reader";

function isValidString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

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

function ShieldIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 3.5 19 6v5.5c0 4.6-2.8 7.8-7 9-4.2-1.2-7-4.4-7-9V6l7-2.5Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />

      <path
        d="m8.7 12.1 2.1 2.1 4.5-4.6"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
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

    if (!scanner) {
      if (mountedRef.current) {
        setIsScanning(false);
      }

      return;
    }

    try {
      if (scanner.isScanning) {
        await scanner.stop();
      }
    } catch (stopError) {
      console.warn("Scanner stop warning:", stopError);
    }

    scannerRef.current = null;

    if (mountedRef.current) {
      setIsScanning(false);
    }
  }, []);

  async function handleQRCode(decodedText: string): Promise<void> {
    if (processingRef.current) {
      return;
    }

    processingRef.current = true;

    await stopScanner();

    const qrToken = decodedText.trim();

    if (!isValidString(qrToken)) {
      if (mountedRef.current) {
        setResult({
          success: false,
          valid: false,
          status: "INVALID",
          message: "This QR code is not a valid EntryPass ticket.",
        });
      }

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

      let data: ScanResponse;

      try {
        data = (await response.json()) as ScanResponse;
      } catch {
        data = {
          success: false,
          valid: false,
          status: "ERROR",
          message: "The ticket server returned an invalid response.",
        };
      }

      if (mountedRef.current) {
        setResult(data);
      }
    } catch (scanError) {
      console.error("Ticket scan error:", scanError);

      if (mountedRef.current) {
        setResult({
          success: false,
          valid: false,
          status: "ERROR",
          message: "Unable to connect to the ticket server.",
        });
      }
    } finally {
      processingRef.current = false;
    }
  }

  const startScanner = useCallback(async () => {
    if (isScanning || processingRef.current) {
      return;
    }

    setError("");

    try {
      const existingScanner = scannerRef.current;

      if (existingScanner?.isScanning) {
        return;
      }

      const readerElement = document.getElementById(READER_ID);

      if (!readerElement) {
        throw new Error("QR reader element was not found.");
      }

      readerElement.innerHTML = "";

      const scanner = new Html5Qrcode(READER_ID);

      scannerRef.current = scanner;

      await scanner.start(
        {
          facingMode: "environment",
        },
        {
          fps: 10,
          qrbox: {
            width: 240,
            height: 240,
          },
          aspectRatio: 1,
          disableFlip: false,
        },
        (decodedText) => {
          void handleQRCode(decodedText);
        },
        () => {
          // Normal continuous decode misses are intentionally ignored.
        },
      );

      if (mountedRef.current) {
        setIsScanning(true);
      }
    } catch (scannerError) {
      console.error("Camera error:", scannerError);

      scannerRef.current = null;

      if (mountedRef.current) {
        setIsScanning(false);
        setError(
          "Camera access is unavailable. Allow camera permission and try again.",
        );
      }
    }
  }, [isScanning, stopScanner]);

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;

      const scanner = scannerRef.current;

      if (scanner?.isScanning) {
        void scanner.stop();
      }

      scannerRef.current = null;
    };
  }, []);

  const scanAgain = useCallback(async () => {
    await stopScanner();

    processingRef.current = false;

    if (mountedRef.current) {
      setResult(null);
      setError("");
    }

    window.setTimeout(() => {
      if (mountedRef.current) {
        void startScanner();
      }
    }, 150);
  }, [startScanner, stopScanner]);

  const isValid =
    result?.success === true &&
    result?.valid === true &&
    result?.status === "USED";

  const isUsed = result?.status === "USED" && !isValid;

  return (
    <main className="apple-scanner-page">
      <div className="apple-scanner-background" aria-hidden="true">
        <div className="apple-background-grid" />
        <div className="apple-background-glow apple-background-glow-one" />
        <div className="apple-background-glow apple-background-glow-two" />
      </div>

      <header className="apple-scanner-nav">
        <Link
          href="/"
          className="apple-scanner-logo"
          aria-label="EntryPass home"
        >
          ENTRY<span>PASS</span>
        </Link>

        <div className="apple-scanner-nav-right">
          <span className="apple-gate-pill">
            <i />
            GATE 01
          </span>

          <span className="apple-live-pill">
            <i />
            {isScanning ? "LIVE" : "READY"}
          </span>
        </div>
      </header>

      {!result ? (
        <section className="apple-scanner-main">
          <div className="apple-scanner-heading">
            <div className="apple-scanner-eyebrow">
              <span />
              EVENT ACCESS
            </div>

            <h1>
              Scan. Verify.
              <br />
              <span>Welcome in.</span>
            </h1>

            <p>Point the camera at the QR code on the attendee ticket.</p>
          </div>

          <div className="apple-camera-card">
            <div className="apple-camera-topline">
              <div className="apple-camera-label">
                <CameraIcon />
                <span>Ticket scanner</span>
              </div>

              <div
                className={`apple-camera-status ${isScanning ? "active" : ""}`}
              >
                <i />
                {isScanning ? "Camera active" : "Camera ready"}
              </div>
            </div>

            <div className="apple-camera-stage">
              <div id={READER_ID} className="apple-qr-reader" />

              <div
                className={`apple-scan-frame ${isScanning ? "scanning" : ""}`}
                aria-hidden="true"
              >
                <span className="scan-corner tl" />
                <span className="scan-corner tr" />
                <span className="scan-corner bl" />
                <span className="scan-corner br" />

                {isScanning && (
                  <>
                    <span className="apple-scan-line" />
                    <span className="apple-scan-glow" />
                  </>
                )}
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
                <div className="apple-camera-placeholder error-state">
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
                <span>Start camera</span>
                <ArrowIcon />
              </button>
            )}

            {error && (
              <button
                type="button"
                className="apple-start-button"
                onClick={() => void startScanner()}
              >
                <span>Try again</span>
                <ArrowIcon />
              </button>
            )}

            {isScanning && (
              <div className="apple-scanning-note">
                <div className="apple-scanning-note-left">
                  <i />
                  <span>Scanning for a ticket</span>
                </div>

                <span className="apple-scanning-gate">Gate 01</span>
              </div>
            )}
          </div>

          <div className="apple-security-strip">
            <div className="apple-security-icon">
              <ShieldIcon />
            </div>

            <div className="apple-security-copy">
              <strong>Secure entry validation</strong>

              <span>Each ticket can only be accepted once.</span>
            </div>

            <span className="apple-security-status">Protected</span>
          </div>
        </section>
      ) : (
        <section className="apple-result-main">
          <div
            className={`apple-result-card ${
              isValid ? "valid" : isUsed ? "used" : "invalid"
            }`}
          >
            <div
              className={`apple-result-icon ${
                isValid ? "success" : isUsed ? "warning" : "danger"
              }`}
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

                {result.ticket.scannedAt && (
                  <div>
                    <span>{isValid ? "Scanned at" : "Previously scanned"}</span>

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
              <span>Scan next ticket</span>
              <ArrowIcon />
            </button>
          </div>
        </section>
      )}

      <footer className="apple-scanner-footer">
        <span className="apple-footer-brand">
          ENTRY<span>PASS</span>
        </span>

        <span className="apple-footer-copy">Secure event access system</span>

        <span className="apple-footer-year">2026</span>
      </footer>
    </main>
  );
}
