import Image from "next/image";
import Link from "next/link";

export default function Home() {
  return (
    <main className="navdurga-poster-home">
      <div className="navdurga-poster">
        <Image
          src="/navdurga-event-hero.jpg"
          alt="Nav Durga Raas Dandiya 2026"
          fill
          priority
          sizes="100vw"
          className="navdurga-poster-image"
        />
      </div>

      <div className="navdurga-poster-vignette" />

      <header className="navdurga-access-header">
        <span>EVENT ACCESS</span>
        <span>ENTRY PASS</span>
      </header>

      <Link href="/admin/scanner" className="navdurga-poster-scan">
        <span className="navdurga-poster-scan-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none">
            <path
              d="M4 8V5.5C4 4.67 4.67 4 5.5 4H8M16 4h2.5c.83 0 1.5.67 1.5 1.5V8M20 16v2.5c0 .83-.67 1.5-1.5 1.5H16M8 20H5.5C4.67 20 4 19.33 4 18.5V16"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
            />
            <path
              d="M8 9h2v2H8zM14 9h2v2h-2zM8 14h2v2H8zM14 14h2v2h-2z"
              fill="currentColor"
            />
          </svg>
        </span>

        <span>Scan a ticket</span>

        <span className="navdurga-poster-arrow" aria-hidden="true">
          →
        </span>
      </Link>

      <style>{`
        .navdurga-poster-home {
          position: relative;
          width: 100%;
          min-height: 100svh;
          overflow: hidden;
          background: #f8efe0;
          color: #741017;
        }

        .navdurga-poster {
          position: absolute;
          inset: 0;
          display: grid;
          place-items: center;
          overflow: hidden;
          background: #f8efe0;
        }

        .navdurga-poster-image {
          width: 100%;
          height: 100%;
          display: block;
          object-fit: cover;
          object-position: center;
        }

        .navdurga-poster-vignette {
          position: absolute;
          inset: 0;
          pointer-events: none;
          background:
            linear-gradient(
              180deg,
              rgba(64, 4, 7, 0.14) 0%,
              transparent 18%,
              transparent 68%,
              rgba(44, 3, 5, 0.62) 100%
            );
        }

        .navdurga-access-header {
          position: absolute;
          top: 28px;
          left: 50%;
          z-index: 5;
          width: min(1540px, calc(100% - 72px));
          transform: translateX(-50%);
          display: flex;
          align-items: center;
          justify-content: space-between;
          pointer-events: none;
          color: #7c1118;
          font-family: Georgia, "Times New Roman", serif;
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 0.22em;
        }

        .navdurga-access-header span:last-child {
          padding: 7px 11px;
          border: 1px solid rgba(124, 17, 24, 0.35);
          border-radius: 999px;
          background: rgba(255, 248, 235, 0.55);
          backdrop-filter: blur(8px);
        }

        .navdurga-poster-scan {
          position: absolute;
          left: 50%;
          bottom: 34px;
          z-index: 10;
          width: min(360px, calc(100% - 40px));
          min-height: 60px;
          transform: translateX(-50%);
          padding: 0 17px 0 18px;
          display: flex;
          align-items: center;
          gap: 13px;
          border: 1px solid #6e0c12;
          border-radius: 999px;
          background: linear-gradient(135deg, #8d1018 0%, #b51b22 100%);
          box-shadow:
            0 14px 34px rgba(73, 5, 10, 0.35),
            inset 0 1px 0 rgba(255, 255, 255, 0.22);
          color: #fff9ef;
          text-decoration: none;
          font-family:
            var(--font-geist-sans),
            -apple-system,
            BlinkMacSystemFont,
            "Segoe UI",
            sans-serif;
          font-size: 14px;
          font-weight: 800;
          transition:
            transform 180ms ease,
            box-shadow 180ms ease;
        }

        .navdurga-poster-scan:hover {
          transform: translateX(-50%) translateY(-3px);
          box-shadow:
            0 20px 42px rgba(73, 5, 10, 0.4),
            inset 0 1px 0 rgba(255, 255, 255, 0.22);
        }

        .navdurga-poster-scan:focus-visible {
          outline: 3px solid rgba(215, 173, 99, 0.85);
          outline-offset: 5px;
        }

        .navdurga-poster-scan-icon {
          width: 36px;
          height: 36px;
          flex: 0 0 36px;
          display: grid;
          place-items: center;
          border: 1px solid rgba(255, 255, 255, 0.25);
          border-radius: 50%;
          background: rgba(255, 255, 255, 0.1);
        }

        .navdurga-poster-scan-icon svg {
          width: 18px;
          height: 18px;
        }

        .navdurga-poster-arrow {
          margin-left: auto;
          font-size: 21px;
          font-weight: 400;
        }

        @media (max-width: 900px) {
          .navdurga-poster-image {
            object-position: center center;
          }

          .navdurga-access-header {
            top: 20px;
            width: calc(100% - 32px);
            font-size: 8px;
            letter-spacing: 0.16em;
          }

          .navdurga-poster-scan {
            bottom: 24px;
          }
        }

        @media (max-width: 600px) {
          .navdurga-poster-home {
            min-height: 100svh;
          }

          .navdurga-poster-image {
            object-position: center center;
          }

          .navdurga-poster-vignette {
            background:
              linear-gradient(
                180deg,
                rgba(64, 4, 7, 0.12) 0%,
                transparent 22%,
                transparent 58%,
                rgba(44, 3, 5, 0.7) 100%
              );
          }

          .navdurga-access-header {
            top: 14px;
            width: calc(100% - 24px);
            font-size: 7px;
          }

          .navdurga-access-header span:last-child {
            padding: 5px 8px;
          }

          .navdurga-poster-scan {
            width: calc(100% - 28px);
            min-height: 56px;
            bottom: 16px;
            font-size: 14px;
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .navdurga-poster-scan {
            transition: none;
          }
        }
      `}</style>
    </main>
  );
}
