"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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
  if (!value) return "—";

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
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M9 5.5 10.2 3h3.6L15 5.5H19A2.5 2.5 0 0 1 21.5 8v9A2.5 2.5 0 0 1 19 19.5H5A2.5 2.5 0 0 1 2.5 17V8A2.5 2.5 0 0 1 5 5.5h4Z" />
      <circle cx="12" cy="12.5" r="3.5" />
    </svg>
  );
}

function ShieldIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 3 20 6v5.7c0 4.6-3 7.8-8 9.3-5-1.5-8-4.7-8-9.3V6l8-3Z" />
      <path d="m8.7 12 2.1 2.1 4.6-4.6" />
    </svg>
  );
}

function RefreshIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M20 11a8 8 0 0 0-14.7-4L3 9" />
      <path d="M3 4v5h5" />
      <path d="M4 13a8 8 0 0 0 14.7 4L21 15" />
      <path d="M21 20v-5h-5" />
    </svg>
  );
}

function XIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="m7 7 10 10M17 7 7 17" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="m5 12.5 4.2 4.2L19 7" />
    </svg>
  );
}

function WarningIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 3.5 21 20H3l9-16.5Z" />
      <path d="M12 9v5M12 17h.01" />
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
  const [isStarting, setIsStarting] = useState(false);

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
      // Camera was already stopped.
    }

    setIsScanning(false);
  }, []);

  const handleQRCode = useCallback(
    async (decodedText: string) => {
      if (processingRef.current) {
        return;
      }

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
          message: "This QR code is not a valid event ticket.",
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
          message: "This QR code is missing ticket credentials.",
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
    if (isScanning || isStarting || processingRef.current) {
      return;
    }

    setError("");
    setIsStarting(true);

    try {
      if (scannerRef.current) {
        try {
          if (scannerRef.current.isScanning) {
            await scannerRef.current.stop();
          }

          await scannerRef.current.clear();
        } catch {
          // Existing scanner can be discarded.
        }
      }

      const scanner = new Html5Qrcode(READER_ID);

      scannerRef.current = scanner;

      await scanner.start(
        {
          facingMode: "environment",
        },
        {
          fps: 12,
          qrbox: {
            width: 270,
            height: 270,
          },
          aspectRatio: 1,
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
        "Camera access was blocked. Allow camera permission in your browser and try again.",
      );

      setIsScanning(false);
    } finally {
      if (mountedRef.current) {
        setIsStarting(false);
      }
    }
  }, [handleQRCode, isScanning, isStarting]);

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;

      const scanner = scannerRef.current;

      if (scanner?.isScanning) {
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
    }, 120);
  };

  const isValid = result?.success === true && result?.valid === true;
  const isUsed = result?.status === "USED";
  const isError = result?.status === "ERROR";

  if (result) {
    return (
      <main
        className={`scanner-shell result-shell ${
          isValid ? "is-valid" : "is-denied"
        }`}
      >
        <div className="scanner-glow scanner-glow-one" />
        <div className="scanner-glow scanner-glow-two" />

        <header className="scanner-topbar">
          <div className="brand-lockup">
            <div className="brand-mark">
              <ShieldIcon />
            </div>

            <div>
              <strong>
                ENTRY<span>PASS</span>
              </strong>

              <small>EVENT ACCESS CONTROL</small>
            </div>
          </div>

          <div className="gate-pill">
            <i />
            {GATE}
          </div>
        </header>

        <section className="result-card">
          <div
            className={`result-status-icon ${
              isValid ? "success" : isUsed ? "warning" : "danger"
            }`}
          >
            {isValid ? <CheckIcon /> : isUsed ? <WarningIcon /> : <XIcon />}
          </div>

          <div className="result-kicker">
            {isValid
              ? "VERIFIED TICKET"
              : isUsed
                ? "DUPLICATE ENTRY"
                : isError
                  ? "SYSTEM ERROR"
                  : "INVALID TICKET"}
          </div>

          <h1>
            {isValid
              ? "Entry Approved"
              : isUsed
                ? "Already Checked In"
                : "Entry Denied"}
          </h1>

          <p className="result-copy">
            {isValid
              ? "This ticket is valid. The attendee may enter the venue."
              : result.message}
          </p>

          {result.ticket && (
            <div className="ticket-summary">
              <div className="ticket-id-row">
                <span>Ticket</span>
                <strong>{result.ticket.ticketId}</strong>
              </div>

              <div className="summary-grid">
                <div>
                  <span>TYPE</span>
                  <strong>{result.ticket.ticketType}</strong>
                </div>

                <div>
                  <span>GATE</span>
                  <strong>{result.ticket.gate || GATE}</strong>
                </div>

                <div>
                  <span>EVENT DATE</span>
                  <strong>{formatDate(result.ticket.date)}</strong>
                </div>

                <div>
                  <span>{isUsed ? "CHECK-IN TIME" : "VENUE"}</span>

                  <strong>
                    {isUsed && result.ticket.checkInTime
                      ? formatDateTime(result.ticket.checkInTime)
                      : result.ticket.venue}
                  </strong>
                </div>
              </div>
            </div>
          )}

          <button
            className="scan-next-button"
            type="button"
            onClick={() => void scanAgain()}
          >
            <RefreshIcon />
            SCAN NEXT TICKET
          </button>
        </section>

        <footer className="scanner-footer">
          <span>
            <i /> Scanner secure
          </span>

          <span>Powered by EntryPass</span>
        </footer>
      </main>
    );
  }

  return (
    <main className="scanner-shell">
      <div className="scanner-noise" />

      <div className="scanner-glow scanner-glow-one" />
      <div className="scanner-glow scanner-glow-two" />

      <header className="scanner-topbar">
        <div className="brand-lockup">
          <div className="brand-mark">
            <ShieldIcon />
          </div>

          <div>
            <strong>
              ENTRY<span>PASS</span>
            </strong>

            <small>EVENT ACCESS CONTROL</small>
          </div>
        </div>

        <div className="gate-pill">
          <i />
          {GATE}
        </div>
      </header>

      <section className="scanner-content">
        <div className="scanner-intro">
          <div className="live-badge">
            <i /> LIVE SCANNER
          </div>

          <h1>
            Scan. Verify.
            <br />
            <em>Welcome In.</em>
          </h1>

          <p>Point the camera at the QR code on the attendee&apos;s ticket.</p>
        </div>

        <div className={`camera-card ${isScanning ? "camera-active" : ""}`}>
          <div className="camera-topline">
            <span>
              <CameraIcon />
              CAMERA
            </span>

            <span className={isScanning ? "online" : ""}>
              <i />
              {isScanning ? "READY TO SCAN" : "CAMERA OFF"}
            </span>
          </div>

          <div className="camera-stage">
            <div id={READER_ID} />

            <div className="scan-frame" aria-hidden="true">
              <span className="corner tl" />
              <span className="corner tr" />
              <span className="corner bl" />
              <span className="corner br" />

              {isScanning && <div className="scan-line" />}
            </div>

            {!isScanning && !isStarting && !error && (
              <div className="camera-placeholder">
                <div className="placeholder-icon">
                  <CameraIcon />
                </div>

                <strong>Camera is ready</strong>

                <span>Start the scanner to activate your camera</span>
              </div>
            )}

            {isStarting && (
              <div className="camera-placeholder">
                <div className="spinner" />

                <strong>Starting camera…</strong>

                <span>Allow camera access when prompted</span>
              </div>
            )}
          </div>

          <div className="camera-hint">
            <span>●</span>
            Center the QR code inside the frame
          </div>
        </div>

        {error && (
          <div className="scanner-error">
            <div className="error-icon">
              <WarningIcon />
            </div>

            <div>
              <strong>Camera unavailable</strong>
              <span>{error}</span>
            </div>

            <button type="button" onClick={() => void startScanner()}>
              RETRY
            </button>
          </div>
        )}

        {!isScanning && !isStarting && !error && (
          <button
            className="start-button"
            type="button"
            onClick={() => void startScanner()}
          >
            <CameraIcon />
            START SCANNER
          </button>
        )}

        {isScanning && (
          <div className="scanner-active-note">
            <div className="pulse-dot" />

            <span>Scanning continuously</span>

            <b>Hold the ticket steady</b>
          </div>
        )}

        <div className="security-strip">
          <div>
            <ShieldIcon />

            <span>
              <strong>Secure validation</strong> QR is verified against the
              event database
            </span>
          </div>

          <div>
            <span>
              <strong>Gate</strong> {GATE}
            </span>
          </div>
        </div>
      </section>

      <footer className="scanner-footer">
        <span>
          <i /> Scanner secure
        </span>

        <span>Powered by EntryPass</span>
      </footer>
    </main>
  );
}
