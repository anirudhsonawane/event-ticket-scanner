"use client";

import { QRCodeSVG } from "qrcode.react";
import { Ticket } from "@/data/tickets";

type QRCodeTicketProps = {
  ticket: Ticket;
};

export default function QRCodeTicket({ ticket }: QRCodeTicketProps) {
  const qrData = JSON.stringify({
    ticketId: ticket.ticketId,
    eventName: ticket.eventName,
    eventSubtitle: ticket.eventSubtitle,
    ticketType: ticket.ticketType,
    customerName: ticket.customerName,
    mobile: ticket.mobile,
    date: ticket.date,
    venue: ticket.venue,
  });

  return (
    <div className="ticket-page">
      <div className="ticket-background" />

      <main className="ticket-card">
        <p className="ticket-label">EVENT ENTRY PASS</p>

        <div className="ticket-line" />

        <h1>{ticket.eventName}</h1>

        <h2>{ticket.eventSubtitle}</h2>

        <div className="ticket-line" />

        <div className="qr-container">
          <QRCodeSVG value={qrData} size={280} level="H" includeMargin />
        </div>

        <div className="ticket-info">
          <span>TICKET ID</span>
          <strong>{ticket.ticketId}</strong>
        </div>

        <div className="ticket-divider" />

        <div className="ticket-info">
          <span>TICKET TYPE</span>
          <strong>{ticket.ticketType}</strong>
        </div>

        <div className="ticket-divider" />

        <div className="ticket-info">
          <span>EVENT DATE</span>
          <strong>{ticket.date}</strong>
        </div>

        <div className="ticket-divider" />

        <div className="ticket-info">
          <span>VENUE</span>
          <strong>{ticket.venue}</strong>
        </div>
      </main>
    </div>
  );
}
