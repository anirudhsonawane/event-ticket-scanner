"use client";

import "./scanner.css";

import { useCallback, useEffect, useRef, useState } from "react";

import Link from "next/link";

import { useScanner } from "qrcode-decode-ultra-react";

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

const GATE = "Gate 01";

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
   COMPONENT
   ========================================================= */

export default function QRScanner() {
  /*
   * Prevent duplicate validation requests.
   */
  const processingRef = useRef(false);

  /*
   * React lifecycle.
   */
  const mountedRef = useRef(false);

  /*
   * Prevent multiple Start Camera clicks
   * while the camera is opening.
   */
  const startingRef = useRef(false);

  /*
   * Last decoded value.
   *
   * We only use this as a simple string lock.
   * No performance.now(), Date.now(), timers,
   * or other impure functions are used.
   */
  const lastTokenRef = useRef("");

  const [result, setResult] = useState<ScanResponse | null>(null);

  const [error, setError] = useState("");

  const [isStarting, setIsStarting] = useState(false);

  /*
   * =======================================================
   * SCANNER
   * =======================================================
   *
   * Important:
   *
   * - QR only
   * - fast engine
   * - Web Worker
   * - rear/environment camera
   * - one successful QR per session
   * - no diagnostics callback
   * - no performance.now()
   */

  const {
    videoRef,
    status: scannerStatus,
    start: startCamera,
    stop: stopCamera,
  } = useScanner({
    engines: "fast",

    formats: ["qr_code"],

    worker: true,

    maxScansPerSecond: 30,

    maxCodesPerFrame: 1,

    facingMode: "environment",

    once: true,

    autoStart: false,

    onResult: (scan) => {
      /*
       * Once a scan is being processed,
       * ignore anything else.
       */
      if (processingRef.current) {
        return;
      }

      const qrToken = typeof scan.value === "string" ? scan.value.trim() : "";

      if (!isValidString(qrToken)) {
        return;
      }

      /*
       * Simple duplicate protection.
       *
       * The scanner itself also uses once:true.
       */
      if (qrToken === lastTokenRef.current) {
        return;
      }

      lastTokenRef.current = qrToken;

      /*
       * Useful console information.
       *
       * No impure timing function is called.
       */
      console.log("QR DETECTED:", qrToken);

      if (scan.engine) {
        console.log("QR ENGINE:", scan.engine);
      }

      if (scan.timing) {
        console.log("QR DECODE:", `${scan.timing.totalMs.toFixed(1)}ms`);
      }

      /*
       * Start validation immediately.
       */
      void validateTicket(qrToken);
    },

    onError: (scannerError) => {
      /*
       * Do not show camera errors after
       * a QR has already been detected.
       */
      if (processingRef.current) {
        return;
      }

      console.error("QR scanner error:", scannerError);

      if (mountedRef.current) {
        setError(formatCameraError(scannerError));
      }
    },
  });

  /*
   * =======================================================
   * SCANNING STATE
   * =======================================================
   */

  const isScanning = scannerStatus === "scanning";

  /*
   * =======================================================
   * MOUNT / CLEANUP
   * =======================================================
   */

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;

      processingRef.current = false;

      lastTokenRef.current = "";

      /*
       * Let the scanner binding clean up
       * its own MediaStream.
       */
      void stopCamera();
    };
  }, [stopCamera]);

  /*
   * =======================================================
   * VALIDATE TICKET
   * =======================================================
   */

  const validateTicket = useCallback(
    async (qrToken: string): Promise<void> => {
      if (processingRef.current) {
        return;
      }

      processingRef.current = true;

      /*
       * Stop camera immediately.
       *
       * DO NOT await it before the API request.
       */
      void stopCamera();

      try {
        const response = await fetch("/api/tickets/scan", {
          method: "POST",

          headers: {
            "Content-Type": "application/json",
          },

          cache: "no-store",

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
        console.error("Ticket validation error:", scanError);

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
    },
    [stopCamera],
  );

  /*
   * =======================================================
   * START CAMERA
   * =======================================================
   */

  const startScanner = useCallback(async () => {
    if (startingRef.current || processingRef.current || isScanning) {
      return;
    }

    startingRef.current = true;

    setIsStarting(true);

    setError("");

    /*
     * Reset QR lock.
     */
    lastTokenRef.current = "";

    try {
      /*
       * The React scanner binding handles:
       *
       * getUserMedia()
       * camera selection
       * video stream
       * decoder startup
       */
      await startCamera();

      console.log("Camera started successfully.");
    } catch (cameraError) {
      console.error("Camera start failed:", cameraError);

      if (mountedRef.current) {
        setError(formatCameraError(cameraError));
      }
    } finally {
      startingRef.current = false;

      if (mountedRef.current) {
        setIsStarting(false);
      }
    }
  }, [isScanning, startCamera]);

  /*
   * =======================================================
   * SCAN AGAIN
   * =======================================================
   */

  const scanAgain = useCallback(async () => {
    /*
     * Stop the previous camera.
     */
    try {
      await stopCamera();
    } catch {
      // Ignore cleanup errors.
    }

    processingRef.current = false;

    lastTokenRef.current = "";

    if (mountedRef.current) {
      setResult(null);

      setError("");
    }

    /*
     * Give Safari a very small amount
     * of time to release the previous
     * MediaStream.
     */
    window.setTimeout(() => {
      if (mountedRef.current) {
        void startScanner();
      }
    }, 50);
  }, [startScanner, stopCamera]);

  /*
   * =======================================================
   * RESULT STATES
   * =======================================================
   */

  const isValid =
    result?.success === true &&
    result?.valid === true &&
    result?.status === "USED";

  const isUsed = result?.status === "USED" && !isValid;

  /*
   * =======================================================
   * RENDER
   * =======================================================
   */

  return (
    <main className="apple-scanner-page">
      <header className="apple-scanner-nav">
        <Link
          href="/"
          className="apple-scanner-logo"
          aria-label="EntryPass home"
        >
          ENTRY
          <span>PASS</span>
        </Link>

        <div className="apple-scanner-nav-right">
          <span className="apple-gate-pill">{GATE}</span>

          <span className="apple-live-pill">
            {isScanning ? "LIVE" : isStarting ? "STARTING" : "READY"}
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
                {isScanning
                  ? "Camera active"
                  : isStarting
                    ? "Opening camera"
                    : "Camera ready"}
              </span>
            </div>

            <div className="apple-camera-stage">
              <div className="apple-qr-reader">
                <video
                  ref={videoRef}
                  className="apple-camera-video"
                  autoPlay
                  muted
                  playsInline
                  aria-label="Ticket scanning camera"
                />
              </div>

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

              {!isScanning && !isStarting && !error && (
                <div className="apple-camera-placeholder">
                  <div className="apple-camera-icon">
                    <CameraIcon />
                  </div>

                  <strong>Camera is ready</strong>

                  <span>Start the scanner to activate your camera</span>
                </div>
              )}

              {isStarting && (
                <div className="apple-camera-placeholder">
                  <div className="apple-camera-icon">
                    <CameraIcon />
                  </div>

                  <strong>Opening camera</strong>

                  <span>Please allow camera access if prompted</span>
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

            {!isScanning && !isStarting && !error && (
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
          ENTRY
          <span>PASS</span>
        </span>

        <span className="apple-footer-copy">Secure event access</span>

        <span className="apple-footer-year">2026</span>
      </footer>
    </main>
  );
}
