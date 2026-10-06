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
      return;
    }

    try {
      if (scanner.isScanning) {
        await scanner.stop();
      }
    } catch {
      // Scanner already stopped.
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
          message: "Invalid ticket QR code.",
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
          message: "Invalid ticket QR code.",
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
            width: 280,
            height: 280,
          },
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

      setError("Unable to access camera. Please allow camera permission.");

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
    setError(false as unknown as string);

    window.setTimeout(() => {
      if (mountedRef.current) {
        void startScanner();
      }
    }, 100);
  };

  const isValid = result?.success === true && result?.valid === true;

  const isUsed = result?.status === "USED";

  return (
    <div className="scanner-page">
      {!result && (
        <>
          <div className="scanner-header">
            <span>ADMIN ENTRY</span>

            <h1>Scan Ticket</h1>

            <p>Scan the QR code printed on the ticket.</p>
          </div>

          <div className="scanner-box">
            <div id={READER_ID} />
          </div>

          {!isScanning && !error && (
            <button
              type="button"
              onClick={() => {
                void startScanner();
              }}
            >
              START CAMERA
            </button>
          )}

          {error && (
            <div className="scanner-error">
              {error}

              <button
                type="button"
                onClick={() => {
                  void startScanner();
                }}
              >
                TRY AGAIN
              </button>
            </div>
          )}
        </>
      )}

      {result && (
        <div className={`ticket-result ${isValid ? "valid" : "invalid"}`}>
          <div className={`result-icon ${isValid ? "success" : "danger"}`}>
            {isValid ? "✓" : "✕"}
          </div>

          <p className="result-label">
            {isValid
              ? "TICKET VERIFIED"
              : isUsed
                ? "SECURITY CHECK"
                : "TICKET REJECTED"}
          </p>

          <h1>{isValid ? "ENTRY VALID" : "ENTRY DENIED"}</h1>

          <p className="result-message">
            {isValid
              ? "Ticket accepted. Entry has been recorded."
              : result.message}
          </p>

          <div className="result-divider" />

          {result.ticket && (
            <div className="result-grid">
              <div>
                <span>TICKET ID</span>

                <strong>{result.ticket.ticketId}</strong>
              </div>

              <div>
                <span>TICKET TYPE</span>

                <strong>{result.ticket.ticketType}</strong>
              </div>

              <div>
                <span>DATE</span>

                <strong>{formatDate(result.ticket.date)}</strong>
              </div>

              {isUsed && result.ticket.checkInTime && (
                <div>
                  <span>CHECKED IN</span>

                  <strong>{formatDateTime(result.ticket.checkInTime)}</strong>
                </div>
              )}

              <div>
                <span>VENUE</span>

                <strong>{result.ticket.venue}</strong>
              </div>

              {isUsed && result.ticket.gate && (
                <div>
                  <span>GATE</span>

                  <strong>{result.ticket.gate}</strong>
                </div>
              )}
            </div>
          )}

          <button
            type="button"
            onClick={() => {
              void scanAgain();
            }}
          >
            SCAN NEXT TICKET
          </button>
        </div>
      )}
    </div>
  );
}
