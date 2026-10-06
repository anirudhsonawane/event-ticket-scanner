import Link from "next/link";

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

function ShieldIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 3 20 6v5.5c0 4.5-3 7.7-8 9.5-5-1.8-8-5-8-9.5V6l8-3Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />

      <path
        d="m8.5 12 2.2 2.2 4.8-4.8"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function Home() {
  return (
    <main className="entry-home">
      <header className="entry-header">
        <Link href="/" className="entry-logo">
          <div className="entry-logo-mark">
            <ShieldIcon />
          </div>

          <div>
            <strong>
              ENTRY<span>PASS</span>
            </strong>
            <small>EVENT ACCESS</small>
          </div>
        </Link>

        <div className="entry-header-right">
          <span className="online-status">
            <i />
            System online
          </span>

          <span className="gate-label">Gate 01</span>
        </div>
      </header>

      <section className="entry-main">
        <div className="entry-heading">
          <span className="entry-section-label">EVENT OPERATIONS</span>

          <h1>Event Access</h1>

          <p>Manage attendee entry and ticket validation from one place.</p>
        </div>

        <div className="entry-actions">
          <Link href="/admin/scanner" className="entry-action scanner-action">
            <div className="entry-action-icon">
              <ScanIcon />
            </div>

            <div className="entry-action-content">
              <span>PRIMARY ACTION</span>

              <strong>Scan Ticket</strong>

              <p>Open the camera and verify an attendee QR code.</p>
            </div>

            <div className="entry-action-arrow">
              <ArrowIcon />
            </div>
          </Link>

          <Link href="/admin/tickets" className="entry-action">
            <div className="entry-action-icon">
              <TicketIcon />
            </div>

            <div className="entry-action-content">
              <span>TICKET CENTER</span>

              <strong>Manage Tickets</strong>

              <p>View and manage tickets generated for the event.</p>
            </div>

            <div className="entry-action-arrow">
              <ArrowIcon />
            </div>
          </Link>
        </div>

        <div className="system-section">
          <div className="system-heading">
            <span>System</span>

            <small>All services operational</small>
          </div>

          <div className="system-grid">
            <div className="system-item">
              <div className="system-item-top">
                <span>Scanner</span>

                <i className="status-dot" />
              </div>

              <strong>Ready</strong>

              <small>Camera available</small>
            </div>

            <div className="system-item">
              <div className="system-item-top">
                <span>Gate</span>

                <span className="system-value">01</span>
              </div>

              <strong>Active</strong>

              <small>Entry point enabled</small>
            </div>

            <div className="system-item">
              <div className="system-item-top">
                <span>Database</span>

                <i className="status-dot" />
              </div>

              <strong>Connected</strong>

              <small>Ticket validation online</small>
            </div>
          </div>
        </div>
      </section>

      <footer className="entry-footer">
        <span>
          ENTRY<span>PASS</span>
        </span>

        <span>Secure event access system</span>

        <span>2026</span>
      </footer>
    </main>
  );
}
