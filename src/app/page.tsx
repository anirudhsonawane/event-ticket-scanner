import Link from "next/link";

export default function Home() {
  return (
    <main className="apple-home">
      <header className="apple-nav">
        <Link href="/" className="apple-logo" aria-label="EntryPass home">
          ENTRY<span>PASS</span>
        </Link>

        <nav className="apple-nav-links" aria-label="Main navigation">
          <Link href="/admin/scanner">Scanner</Link>
        </nav>
      </header>

      <section className="apple-hero">
        <div className="apple-eyebrow">EVENT ACCESS</div>

        <h1>
          Entry, <span /> made
          <br />
          simple.
        </h1>

        <p>
          Scan tickets, verify entry, and manage
          <br />
          your event from one place.
        </p>

        <div className="apple-actions">
          <Link href="/admin/scanner" className="apple-primary-button">
            Scan a ticket
          </Link>

          <Link href="/admin/tickets" className="apple-secondary-button">
            Manage tickets
          </Link>
        </div>
      </section>

      <footer className="apple-footer">
        <span>
          ENTRY<span>PASS</span>
        </span>
        <span>Made by, Anirudh Sonawane</span>
      </footer>
    </main>
  );
}
