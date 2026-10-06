"use client";

import { useState } from "react";

export default function TicketGeneratorPage() {
  const [singleCount, setSingleCount] = useState(500);

  const [coupleCount, setCoupleCount] = useState(250);

  const [loading, setLoading] = useState<string | null>(null);

  async function generatePDF(type: "single" | "couple", count: number) {
    try {
      setLoading(type);

      const response = await fetch(
        `/api/tickets/pdf?type=${type}&count=${count}`,
      );

      if (!response.ok) {
        throw new Error("Failed to generate PDF");
      }

      const blob = await response.blob();

      const url = window.URL.createObjectURL(blob);

      const link = document.createElement("a");

      link.href = url;

      link.download =
        type === "single" ? "single-tickets.pdf" : "couple-tickets.pdf";

      document.body.appendChild(link);

      link.click();

      link.remove();

      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error(error);

      alert("Unable to generate PDF.");
    } finally {
      setLoading(null);
    }
  }

  return (
    <main className="generator-page">
      <div className="generator-header">
        <span>TICKET MANAGEMENT</span>

        <h1>QR Ticket Generator</h1>

        <p>Generate unique QR tickets for your event.</p>
      </div>

      <div className="generator-grid">
        <section className="generator-card">
          <div className="card-label">SINGLE</div>

          <h2>Single Entry</h2>

          <p>Generate individual entry tickets with unique QR codes.</p>

          <label>Number of tickets</label>

          <input
            type="number"
            min="1"
            max="5000"
            value={singleCount}
            onChange={(event) => setSingleCount(Number(event.target.value))}
          />

          <button
            onClick={() => generatePDF("single", singleCount)}
            disabled={loading !== null}
          >
            {loading === "single" ? "GENERATING..." : "GENERATE SINGLE PDF"}
          </button>
        </section>

        <section className="generator-card">
          <div className="card-label">COUPLE</div>

          <h2>Couple Entry</h2>

          <p>Generate couple entry tickets with unique QR codes.</p>

          <label>Number of tickets</label>

          <input
            type="number"
            min="1"
            max="5000"
            value={coupleCount}
            onChange={(event) => setCoupleCount(Number(event.target.value))}
          />

          <button
            onClick={() => generatePDF("couple", coupleCount)}
            disabled={loading !== null}
          >
            {loading === "couple" ? "GENERATING..." : "GENERATE COUPLE PDF"}
          </button>
        </section>
      </div>
    </main>
  );
}
