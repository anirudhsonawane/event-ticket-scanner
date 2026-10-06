"use client";

import { useState } from "react";

type TicketType = "single" | "couple";

function TicketIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M5 7.5A2.5 2.5 0 0 1 7.5 5h9A2.5 2.5 0 0 1 19 7.5V9a2 2 0 0 0 0 4v1.5a2.5 2.5 0 0 1-2.5 2.5h-9A2.5 2.5 0 0 1 5 14.5V13a2 2 0 0 0 0-4V7.5Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />

      <path
        d="M12 7.5v9"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeDasharray="1.5 2"
      />
    </svg>
  );
}

function ScanIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M4 8V6.5A2.5 2.5 0 0 1 6.5 4H8"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />

      <path
        d="M16 4h1.5A2.5 2.5 0 0 1 20 6.5V8"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />

      <path
        d="M20 16v1.5a2.5 2.5 0 0 1-2.5 2.5H16"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />

      <path
        d="M8 20H6.5A2.5 2.5 0 0 1 4 17.5V16"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />

      <path
        d="M7 12h10"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    </svg>
  );
}

function DownloadIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 4v11"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />

      <path
        d="m7.5 11.5 4.5 4.5 4.5-4.5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      <path
        d="M5 20h14"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function ArrowIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M5 12h13"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />

      <path
        d="m13 6 6 6-6 6"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function TicketManagementPage() {
  const [singleCount, setSingleCount] = useState(500);
  const [coupleCount, setCoupleCount] = useState(250);

  const [loading, setLoading] = useState<TicketType | null>(null);

  const [error, setError] = useState("");

  async function generatePDF(type: TicketType) {
    setError("");
    setLoading(type);

    try {
      const count = type === "single" ? singleCount : coupleCount;

      if (!Number.isInteger(count) || count < 1 || count > 5000) {
        throw new Error("Enter a quantity between 1 and 5000.");
      }

      const response = await fetch(
        `/api/tickets/pdf?type=${type}&count=${count}`,
        {
          method: "GET",
          cache: "no-store",
        },
      );

      if (!response.ok) {
        let message = "Unable to generate the PDF.";

        try {
          const data = await response.json();

          if (data?.message) {
            message = data.message;
          }
        } catch {
          // Response wasn't JSON.
        }

        throw new Error(message);
      }

      const blob = await response.blob();

      const url = window.URL.createObjectURL(blob);

      const anchor = document.createElement("a");

      anchor.href = url;

      anchor.download = `${type}-tickets-${count}.pdf`;

      document.body.appendChild(anchor);

      anchor.click();

      anchor.remove();

      window.URL.revokeObjectURL(url);
    } catch (requestError) {
      console.error("Failed to generate PDF:", requestError);

      setError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to generate PDF.",
      );
    } finally {
      setLoading(null);
    }
  }

  return (
    <main className="ticket-admin-page">
      <header className="ticket-admin-header">
        <div className="ticket-brand">
          <div className="ticket-brand-mark">
            <TicketIcon />
          </div>

          <div>
            <strong>
              ENTRY<span>PASS</span>
            </strong>

            <small>TICKET MANAGEMENT</small>
          </div>
        </div>

        <div className="ticket-header-status">
          <span>
            <i />
            SYSTEM ONLINE
          </span>

          <span>GATE 01</span>
        </div>
      </header>

      <section className="ticket-admin-main">
        <div className="ticket-admin-heading">
          <div>
            <span>TICKET CENTER</span>

            <h1>Generate Tickets</h1>

            <p>
              Create QR-coded entry passes ready for printing and event
              validation.
            </p>
          </div>

          <a href="/admin/scanner" className="ticket-scan-link">
            <ScanIcon />
            Open Scanner
            <ArrowIcon />
          </a>
        </div>

        {error && (
          <div className="ticket-error">
            <div className="ticket-error-icon">!</div>

            <div>
              <strong>Generation failed</strong>

              <p>{error}</p>
            </div>

            <button type="button" onClick={() => setError("")}>
              Dismiss
            </button>
          </div>
        )}

        <div className="ticket-generator-grid">
          <section className="ticket-generator-card featured">
            <div className="generator-card-header">
              <div className="generator-icon">
                <TicketIcon />
              </div>

              <span className="generator-badge">STANDARD</span>
            </div>

            <div className="generator-copy">
              <span>ENTRY TYPE</span>

              <h2>Single Entry</h2>

              <p>One QR ticket for one attendee.</p>
            </div>

            <div className="generator-form">
              <label htmlFor="single-count">NUMBER OF TICKETS</label>

              <div className="count-input">
                <input
                  id="single-count"
                  type="number"
                  min={1}
                  max={5000}
                  value={singleCount}
                  onChange={(event) =>
                    setSingleCount(Number(event.target.value))
                  }
                />

                <span>TICKETS</span>
              </div>

              <button
                type="button"
                disabled={loading !== null}
                onClick={() => generatePDF("single")}
                className="generate-button"
              >
                {loading === "single" ? (
                  <>
                    <span className="button-spinner" />
                    Preparing PDF...
                  </>
                ) : (
                  <>
                    <DownloadIcon />
                    Generate Single PDF
                  </>
                )}
              </button>
            </div>
          </section>

          <section className="ticket-generator-card">
            <div className="generator-card-header">
              <div className="generator-icon">
                <TicketIcon />
              </div>

              <span className="generator-badge">TWO PERSON</span>
            </div>

            <div className="generator-copy">
              <span>ENTRY TYPE</span>

              <h2>Couple Entry</h2>

              <p>One QR ticket designed for two-person entry.</p>
            </div>

            <div className="generator-form">
              <label htmlFor="couple-count">NUMBER OF TICKETS</label>

              <div className="count-input">
                <input
                  id="couple-count"
                  type="number"
                  min={1}
                  max={5000}
                  value={coupleCount}
                  onChange={(event) =>
                    setCoupleCount(Number(event.target.value))
                  }
                />

                <span>TICKETS</span>
              </div>

              <button
                type="button"
                disabled={loading !== null}
                onClick={() => generatePDF("couple")}
                className="generate-button secondary"
              >
                {loading === "couple" ? (
                  <>
                    <span className="button-spinner" />
                    Preparing PDF...
                  </>
                ) : (
                  <>
                    <DownloadIcon />
                    Generate Couple PDF
                  </>
                )}
              </button>
            </div>
          </section>
        </div>

        <section className="ticket-info-panel">
          <div className="info-icon">
            <TicketIcon />
          </div>

          <div>
            <strong>How ticket generation works</strong>

            <p>
              Existing ticket records are reused automatically. Only the missing
              tickets are created, so repeatedly generating a PDF will not
              create duplicates.
            </p>
          </div>
        </section>
      </section>

      <footer className="ticket-admin-footer">
        <span>
          ENTRY<span>PASS</span>
        </span>

        <span>Secure ticket operations</span>

        <span>2026</span>
      </footer>
    </main>
  );
}
