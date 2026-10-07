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

type CameraDevice = {
  id: string;
  label: string;
};

const READER_ID = "qr-reader";
const GATE = "Gate 01";

/* =========================================================
   HELPERS
   ========================================================= */

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

function formatCameraError(error: unknown): string {
  if (error instanceof DOMException) {
    switch (error.name) {
      case "NotAllowedError":
        return "Camera permission was denied. Please allow camera access and try again.";

      case "PermissionDeniedError":
        return "Camera permission was denied. Please allow camera access and try again.";

      case "NotFoundError":
        return "No camera was found on this device.";

      case "NotReadableError":
        return "The camera is already being used by another application.";

      case "OverconstrainedError":
        return "The requested camera is not available on this device.";

      case "SecurityError":
        return "Camera access is blocked by the browser security settings.";

      case "AbortError":
        return "Camera startup was interrupted. Please try again.";

      default:
        return error.message || "Unable to start the camera.";
    }
  }

  if (error instanceof Error) {
    return error.message || "Unable to start the camera.";
  }

  if (typeof error === "string") {
    return error;
  }

  if (error && typeof error === "object") {
    const possibleError = error as {
      message?: unknown;
      name?: unknown;
    };

    if (typeof possibleError.message === "string") {
      return possibleError.message;
    }

    if (typeof possibleError.name === "string") {
      return possibleError.name;
    }
  }

  return "Unable to start the camera. Please try again.";
}

/* =========================================================
   ICONS
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
        d="M12 3.5 19 6v5.2c0 4.5-2.9 7.9-7 9.3-4.1-1.4-7-4.8-7-9.3V6l7-2.5Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />

      <path
        d="m9 12 2 2 4-4"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/* =========================================================
   COMPONENT
   ========================================================= */

export default function QRScanner() {
  const scannerRef = useRef<Html5Qrcode | null>(null);

  const processingRef = useRef(false);

  const mountedRef = useRef(false);

  const startingRef = useRef(false);

  const [result, setResult] = useState<ScanResponse | null>(null);

  const [error, setError] = useState("");

  const [isScanning, setIsScanning] = useState(false);

  /* =======================================================
     STOP SCANNER
     ======================================================= */

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

    try {
      const reader = document.getElementById(READER_ID);

      if (reader) {
        reader.innerHTML = "";
      }
    } catch {
      // Ignore cleanup errors.
    }

    scannerRef.current = null;

    if (mountedRef.current) {
      setIsScanning(false);
    }
  }, []);

  /* =======================================================
     HANDLE QR
     ======================================================= */

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

  /* =======================================================
     GET AVAILABLE CAMERAS
     ======================================================= */

  const getBestCamera = useCallback(async (): Promise<CameraDevice> => {
    const cameras = await Html5Qrcode.getCameras();

    if (!cameras || cameras.length === 0) {
      throw new Error("No camera was detected on this device.");
    }

    console.log("Available cameras:", cameras);

    /*
     * Prefer a rear camera when
     * the device exposes one.
     */

    const rearCamera = cameras.find((camera) => {
      const label = camera.label.toLowerCase();

      return (
        label.includes("back") ||
        label.includes("rear") ||
        label.includes("environment")
      );
    });

    if (rearCamera) {
      return rearCamera;
    }

    /*
     * Mac normally reaches this point
     * and uses the available FaceTime
     * camera.
     */

    return cameras[0];
  }, []);

  /* =======================================================
     START SCANNER
     ======================================================= */

  const startScanner = useCallback(async () => {
    if (startingRef.current || isScanning || processingRef.current) {
      return;
    }

    startingRef.current = true;

    setError("");

    try {
      /*
       * Clean up anything from a
       * previous scanner instance.
       */

      await stopScanner();

      const reader = document.getElementById(READER_ID);

      if (!reader) {
        throw new Error("QR scanner container was not found.");
      }

      reader.innerHTML = "";

      /*
       * Ask browser/library for cameras.
       *
       * This is the important change.
       */

      const camera = await getBestCamera();

      console.log("Selected camera:", camera);

      /*
       * Create fresh scanner.
       */

      const scanner = new Html5Qrcode(READER_ID);

      scannerRef.current = scanner;

      /*
       * Start using actual camera ID.
       *
       * NO formatsToSupport.
       * NO forced environment mode.
       */

      await scanner.start(
        camera.id,
        {
          fps: 10,

          qrbox: {
            width: 220,
            height: 220,
          },

          disableFlip: false,
        },
        (decodedText) => {
          void handleQRCode(decodedText);
        },
        () => {
          /*
           * Ignore continuous
           * decode misses.
           */
        },
      );

      if (!mountedRef.current) {
        return;
      }

      setIsScanning(true);

      console.log("QR scanner started successfully.");
    } catch (scannerError) {
      console.error("QR scanner start failed:", scannerError);

      try {
        const scanner = scannerRef.current;

        if (scanner?.isScanning) {
          await scanner.stop();
        }
      } catch {
        // Ignore cleanup error.
      }

      scannerRef.current = null;

      if (mountedRef.current) {
        setIsScanning(false);

        setError(formatCameraError(scannerError));
      }
    } finally {
      startingRef.current = false;
    }
  }, [getBestCamera, isScanning, stopScanner]);

  /* =======================================================
     LIFECYCLE
     ======================================================= */

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

  /* =======================================================
     SCAN AGAIN
     ======================================================= */

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

  /* =======================================================
     RESULT STATES
     ======================================================= */

  const isValid =
    result?.success === true &&
    result?.valid === true &&
    result?.status === "USED";

  const isUsed = result?.status === "USED" && !isValid;

  /* =======================================================
     RENDER
     ======================================================= */

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

        <div className="apple-scanner-nav-right">
          <span className="apple-gate-pill">{GATE}</span>

          <span className="apple-live-pill">
            {isScanning ? "LIVE" : "READY"}
          </span>
        </div>
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
              <span className="apple-camera-label">Ticket Scanner</span>

              <span className="apple-camera-status">
                {isScanning ? "Camera active" : "Camera ready"}
              </span>
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
              <div className="apple-camera-action">
                <button
                  type="button"
                  className="apple-start-button"
                  onClick={() => void startScanner()}
                >
                  Start camera
                  <ArrowIcon />
                </button>
              </div>
            )}

            {error && (
              <div className="apple-camera-action">
                <button
                  type="button"
                  className="apple-start-button"
                  onClick={() => void startScanner()}
                >
                  Try again
                  <ArrowIcon />
                </button>
              </div>
            )}

            {isScanning && (
              <div className="apple-scanning-note">
                <span className="apple-scanning-note-left">
                  Scanning for a ticket
                </span>

                <span className="apple-scanning-gate">{GATE}</span>
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
              Scan next ticket
              <ArrowIcon />
            </button>
          </div>
        </section>
      )}

      <footer className="apple-scanner-footer">
        <span className="apple-footer-brand">
          ENTRY<span>PASS</span>
        </span>

        <span className="apple-footer-copy">Secure event access</span>

        <span className="apple-footer-year">2026</span>
      </footer>
    </main>
  );
}
