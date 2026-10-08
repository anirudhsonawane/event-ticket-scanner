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

function FlashlightIcon({ active = false }: { active?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M9 3h6l1 4H8l1-4Z"
        fill={active ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path
        d="M9 7h6v4.5l-1.5 2V21h-3v-7.5L9 11.5V7Z"
        fill={active ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path
        d="M8 3h8"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
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

function NavDurgaMark() {
  return (
    <svg
      className="nd-logo-mark"
      viewBox="0 0 54 72"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M28 5v61"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
      <path
        d="M28 12c-7 1-12 5-15 10 6-2 11-1 15 2"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M29 13c7 0 12 3 16 8-6-1-11 0-16 4"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M11 29c5-8 12-10 18-8 6-2 13 0 18 8-6-4-12-4-18 0-6-4-12-4-18 0Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <circle cx="29" cy="29" r="3.2" fill="currentColor" />
      <path
        d="M23 2c2 3 3 5 6 7 2-2 3-4 3-7"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </svg>
  );
}

function GateIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M5 20V9l7-5 7 5v11M3 20h18M8 20v-6h8v6"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M10 10h4"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    </svg>
  );
}

function CalendarIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect
        x="4"
        y="5.5"
        width="16"
        height="15"
        rx="2"
        stroke="currentColor"
        strokeWidth="1.7"
      />
      <path
        d="M8 3.5v4M16 3.5v4M4 9.5h16"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
      <path
        d="M8 13h2M14 13h2M8 16.5h2M14 16.5h2"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </svg>
  );
}

function VenueIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 21s6-6.1 6-11a6 6 0 1 0-12 0c0 4.9 6 11 6 11Z"
        stroke="currentColor"
        strokeWidth="1.7"
      />
      <circle cx="12" cy="10" r="2.2" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

function PeopleIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="9" cy="8" r="3" stroke="currentColor" strokeWidth="1.6" />
      <circle
        cx="16.5"
        cy="9"
        r="2.4"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <path
        d="M3.5 19c.5-3.5 2.5-5.5 5.5-5.5s5 2 5.5 5.5M14 14.5c3-.2 5.2 1.5 5.8 4.5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

function DandiyaIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="m6 4 14 14M18 4 4 18"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
      <path
        d="m5 3 2 2M17 3l-2 2M3 17l2 2M19 17l-2 2"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

function QrMiniIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4z"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <path
        d="M15 15h2v2h-2zM18 18h2v2h-2zM18 14h2M14 20h2"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
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
   * Torch / flashlight state.
   *
   * The torch is controlled through the active camera
   * MediaStreamTrack. It is supported on many Android
   * browsers, but not universally on iOS/Safari.
   */
  const [isTorchOn, setIsTorchOn] = useState(false);
  const [torchSupported, setTorchSupported] = useState(false);

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
   * TORCH / FLASHLIGHT
   * =======================================================
   */

  const getCameraTrack = useCallback((): MediaStreamTrack | null => {
    const video = videoRef.current;

    if (!(video instanceof HTMLVideoElement)) {
      return null;
    }

    const stream = video.srcObject;

    if (!(stream instanceof MediaStream)) {
      return null;
    }

    return stream.getVideoTracks()[0] ?? null;
  }, [videoRef]);

  const updateTorchSupport = useCallback(() => {
    const track = getCameraTrack();

    if (!track) {
      setTorchSupported(false);
      return false;
    }

    const capabilities = track.getCapabilities?.();

    if (!capabilities || !("torch" in capabilities)) {
      setTorchSupported(false);
      return false;
    }

    setTorchSupported(true);
    return true;
  }, [getCameraTrack]);

  const setTorch = useCallback(
    async (enabled: boolean) => {
      const track = getCameraTrack();

      if (!track) {
        setTorchSupported(false);
        setIsTorchOn(false);
        return;
      }

      const capabilities = track.getCapabilities?.();

      if (!capabilities || !("torch" in capabilities)) {
        setTorchSupported(false);
        setIsTorchOn(false);
        return;
      }

      try {
        await track.applyConstraints({
          advanced: [{ torch: enabled } as MediaTrackConstraintSet],
        });

        setTorchSupported(true);
        setIsTorchOn(enabled);
      } catch (torchError) {
        console.error("Unable to control camera torch:", torchError);
        setIsTorchOn(false);
      }
    },
    [getCameraTrack],
  );

  const waitForTorchSupport = useCallback(async () => {
    /*
     * Some browsers attach the MediaStream to the video element
     * slightly after startCamera() resolves. Retry briefly so the
     * torch button is not hidden because the track was not ready
     * on the first capability check.
     */
    for (let attempt = 0; attempt < 12; attempt += 1) {
      if (!mountedRef.current) {
        return false;
      }

      if (updateTorchSupport()) {
        return true;
      }

      await new Promise<void>((resolve) => {
        window.setTimeout(resolve, 50);
      });
    }

    return false;
  }, [updateTorchSupport]);

  const toggleTorch = useCallback(() => {
    void setTorch(!isTorchOn);
  }, [isTorchOn, setTorch]);

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
       * Turn the flashlight off before releasing
       * the camera stream.
       */
      void setTorch(false);

      /*
       * Let the scanner binding clean up
       * its own MediaStream.
       */
      void stopCamera();
    };
  }, [stopCamera]);

  useEffect(() => {
    if (scannerStatus !== "scanning") {
      return;
    }

    void waitForTorchSupport();
  }, [scannerStatus, waitForTorchSupport]);

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
       * Turn the torch off and stop the camera immediately.
       *
       * DO NOT await either before the API request.
       */
      void setTorch(false);
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
    [setTorch, stopCamera],
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

      /*
       * The scanner has now started the camera. The active
       * MediaStream may take a moment to become available on
       * the video element, so wait briefly for torch support.
       */
      await waitForTorchSupport();

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
  }, [isScanning, startCamera, waitForTorchSupport]);

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
      await setTorch(false);
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
  }, [setTorch, startScanner, stopCamera]);

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
    <main className="navdurga-scanner-page">
      <div
        className="nd-background-art nd-background-art-left"
        aria-hidden="true"
      >
        <span className="nd-mandala nd-mandala-one" />
        <span className="nd-mandala nd-mandala-two" />
        <span className="nd-dandiya nd-dandiya-one" />
      </div>

      <div
        className="nd-background-art nd-background-art-right"
        aria-hidden="true"
      >
        <span className="nd-mandala nd-mandala-three" />
        <span className="nd-mandala nd-mandala-four" />
        <span className="nd-dandiya nd-dandiya-two" />
      </div>

      <header className="nd-header">
        <Link href="/" className="nd-brand" aria-label="Nav Durga scanner home">
          <span className="nd-brand-mark">
            <NavDurgaMark />
          </span>

          <span className="nd-brand-wordmark">
            <span className="nd-brand-nav">NAV</span>
            <span className="nd-brand-durga">Durga</span>
            <span className="nd-brand-subtitle">RAAS DANDIYA</span>
            <span className="nd-brand-year">2026</span>
          </span>
        </Link>

        <div className="nd-header-divider" />

        <p className="nd-tagline">
          The Rhythm of Dandiya.
          <br />
          The Spirit of Maharashtra.
        </p>

        <div className="nd-header-spacer" />

        <div className="nd-header-status">
          <div className="nd-status-pill nd-gate-pill">
            <GateIcon />
            <span>{GATE}</span>
          </div>

          <div className="nd-status-pill nd-live-pill">
            <span className="nd-live-dot" />
            <span className="nd-live-copy">
              <strong>
                {isScanning ? "LIVE" : isStarting ? "STARTING" : "READY"}
              </strong>
              <small>EVENT ACCESS</small>
            </span>
          </div>
        </div>
      </header>

      {!result ? (
        <section className="nd-scanner-main">
          <div className="nd-heading">
            <div className="nd-heading-kicker">
              <span />
              <strong>SCAN TICKET</strong>
              <span />
            </div>

            <h1>
              Ready for
              <br />
              <em>entry.</em>
            </h1>

            <p>
              Point the camera at the QR code
              <br className="nd-desktop-break" /> on the attendee ticket.
            </p>
          </div>

          <div className="nd-camera-wrap">
            <div className="nd-camera-shell">
              <div className="nd-camera-stage">
                <div className="nd-camera-glass" />

                <video
                  ref={videoRef}
                  className="nd-camera-video"
                  autoPlay
                  muted
                  playsInline
                  aria-label="Ticket scanning camera"
                />

                <div className="nd-camera-vignette" />

                <div
                  className={`nd-scan-frame ${isScanning ? "is-scanning" : ""}`}
                  aria-hidden="true"
                >
                  <span className="nd-scan-corner nd-scan-tl" />
                  <span className="nd-scan-corner nd-scan-tr" />
                  <span className="nd-scan-corner nd-scan-bl" />
                  <span className="nd-scan-corner nd-scan-br" />

                  {isScanning && <span className="nd-scan-line" />}

                  {!isScanning && !isStarting && !error && (
                    <div className="nd-frame-hint">
                      <QrMiniIcon />
                      <span>
                        Position the QR code
                        <br />
                        within the frame
                      </span>
                    </div>
                  )}
                </div>

                {!isScanning && !isStarting && !error && (
                  <div className="nd-camera-placeholder">
                    <span className="nd-placeholder-dot" />
                    <strong>Camera ready</strong>
                  </div>
                )}

                {isStarting && (
                  <div className="nd-camera-placeholder">
                    <span className="nd-placeholder-spinner" />
                    <strong>Opening camera</strong>
                    <small>Please allow camera access if prompted</small>
                  </div>
                )}

                {error && (
                  <div className="nd-camera-placeholder nd-camera-error">
                    <span className="nd-error-icon">
                      <CloseIcon />
                    </span>
                    <strong>Camera unavailable</strong>
                    <small>{error}</small>
                  </div>
                )}
              </div>
            </div>

            <div className="nd-camera-actions">
              {!isScanning && !isStarting && !error && (
                <button
                  type="button"
                  className="nd-primary-button"
                  onClick={() => void startScanner()}
                >
                  <QrMiniIcon />
                  <span>Start scanner</span>
                  <ArrowIcon />
                </button>
              )}

              {error && (
                <button
                  type="button"
                  className="nd-primary-button"
                  onClick={() => void startScanner()}
                >
                  <CameraIcon />
                  <span>Try again</span>
                  <ArrowIcon />
                </button>
              )}

              {isScanning && (
                <div className="nd-scanning-button-state">
                  <span className="nd-button-live-dot" />
                  <span>Scanning ticket</span>
                </div>
              )}
            </div>

            <div className="nd-control-bar">
              <div className="nd-control-item">
                <span
                  className={`nd-control-dot ${
                    isScanning ? "active" : "ready"
                  }`}
                />
                <span>
                  {isScanning
                    ? "Camera active"
                    : isStarting
                      ? "Opening camera"
                      : "Camera ready"}
                </span>
              </div>

              <span className="nd-control-divider" />

              <div
                className={`nd-control-item nd-torch-control ${
                  torchSupported ? "" : "unsupported"
                }`}
              >
                <FlashlightIcon active={isTorchOn} />

                <span>{isTorchOn ? "Torch on" : "Torch off"}</span>

                <button
                  type="button"
                  className={`nd-torch-switch ${isTorchOn ? "on" : ""}`}
                  onClick={toggleTorch}
                  disabled={!isScanning || !torchSupported}
                  aria-label={
                    torchSupported
                      ? isTorchOn
                        ? "Turn torch off"
                        : "Turn torch on"
                      : "Torch is not supported by this camera"
                  }
                  aria-pressed={isTorchOn}
                  title={
                    torchSupported
                      ? isTorchOn
                        ? "Turn torch off"
                        : "Turn torch on"
                      : "Torch unavailable on this device"
                  }
                >
                  <span />
                </button>
              </div>
            </div>
          </div>

          <div className="nd-ornament-divider" aria-hidden="true">
            <span />
            <i />
            <span />
          </div>

          <div className="nd-event-info">
            <div className="nd-info-item">
              <span className="nd-info-icon">
                <CalendarIcon />
              </span>
              <div>
                <strong>13 OCT – 19 OCT 2026</strong>
                <small>7 Days Celebration</small>
              </div>
            </div>

            <div className="nd-info-separator" />

            <div className="nd-info-item nd-venue-item">
              <span className="nd-info-icon">
                <VenueIcon />
              </span>
              <div>
                <strong>Gurukul Olympiad School</strong>
                <small>Chhatrapati Sambhajinagar, Maharashtra 431010</small>
              </div>
            </div>

            <div className="nd-info-separator" />

            <div className="nd-info-item">
              <span className="nd-info-icon">
                <PeopleIcon />
              </span>
              <div>
                <strong>5K+</strong>
                <small>People Per Day</small>
              </div>
            </div>
          </div>

          <div className="nd-security-line">
            <ShieldIcon />
            <span>Secure entry validation</span>
            <i />
            <span>Each ticket can only be accepted once.</span>
          </div>
        </section>
      ) : (
        <section className="nd-result-main">
          <div className={`nd-result-card ${isValid ? "valid" : "invalid"}`}>
            <div className="nd-result-top">
              <span
                className={`nd-result-icon ${isValid ? "success" : "danger"}`}
              >
                {isValid ? <CheckIcon /> : <CloseIcon />}
              </span>

              <span className="nd-result-kicker">
                {isValid
                  ? "TICKET VERIFIED"
                  : isUsed
                    ? "SECURITY CHECK"
                    : "TICKET REJECTED"}
              </span>
            </div>

            <h1>{isValid ? "Entry valid." : "Entry denied."}</h1>

            <p className="nd-result-message">
              {isValid
                ? "Ticket accepted. Entry has been recorded."
                : result.message}
            </p>

            {result.ticket && (
              <div className="nd-result-grid">
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
              className="nd-next-button"
              onClick={() => void scanAgain()}
            >
              <QrMiniIcon />
              <span>Scan next ticket</span>
              <ArrowIcon />
            </button>
          </div>
        </section>
      )}

      <footer className="nd-footer">
        <span className="nd-footer-brand">
          NAV <strong>Durga</strong>
        </span>

        <span className="nd-footer-copy">EVENT ACCESS · GATE 01</span>

        <span className="nd-footer-maker">Made by, Anirudh Sonawane</span>
      </footer>
    </main>
  );
}
