"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import type { RealtimeChannel } from "@supabase/supabase-js";

import styles from "./tickets.module.css";

type TicketStats = {
  total: number;
  single: number;
  couple: number;
  unused: number;
  used: number;
};

type StatsResponse = {
  success: boolean;
  message?: string;
  tickets?: TicketStats;
  updatedAt?: string;
};

function ArrowIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M5 12h13"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />

      <path
        d="m13 6 6 6-6 6"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function RefreshIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M20 11a8 8 0 0 0-14.9-3M4 5v4h4"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      <path
        d="M4 13a8 8 0 0 0 14.9 3M20 19v-4h-4"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function TicketsPage() {
  const [stats, setStats] = useState<TicketStats>({
    total: 0,
    single: 0,
    couple: 0,
    unused: 0,
    used: 0,
  });

  const [loading, setLoading] = useState(true);

  const [error, setError] = useState("");

  const [lastUpdated, setLastUpdated] = useState("");

  const [realtimeConnected, setRealtimeConnected] = useState(false);

  const loadStats = useCallback(async () => {
    try {
      const response = await fetch("/api/tickets/stats", {
        method: "GET",
        cache: "no-store",
      });

      const data: StatsResponse = await response.json();

      if (!response.ok || !data.success || !data.tickets) {
        throw new Error(data.message || "Unable to load ticket statistics.");
      }

      setStats(data.tickets);

      setLastUpdated(data.updatedAt || new Date().toISOString());

      setError("");
    } catch (error) {
      console.error("[TICKETS] Failed to load stats:", error);

      setError(
        error instanceof Error
          ? error.message
          : "Unable to load ticket statistics.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const initialLoad = window.setTimeout(() => {
      loadStats();
    }, 0);

    return () => {
      window.clearTimeout(initialLoad);
    };
  }, [loadStats]);

  /*
   * Supabase Realtime.
   *
   * We intentionally use the browser Supabase client
   * here so the page can receive ticket UPDATE events.
   */
  useEffect(() => {
    let channel: RealtimeChannel | null = null;

    let cancelled = false;

    const connectRealtime = async () => {
      try {
        const { supabase } = await import("@/lib/supabase");

        if (cancelled) {
          return;
        }

        channel = supabase
          .channel("tickets-live-dashboard")
          .on(
            "postgres_changes",
            {
              event: "*",
              schema: "public",
              table: "tickets",
            },
            () => {
              loadStats();
            },
          )
          .subscribe((status) => {
            if (status === "SUBSCRIBED") {
              setRealtimeConnected(true);
            }

            if (
              status === "CHANNEL_ERROR" ||
              status === "TIMED_OUT" ||
              status === "CLOSED"
            ) {
              setRealtimeConnected(false);
            }
          });
      } catch (error) {
        console.error("[TICKETS] Realtime connection failed:", error);

        setRealtimeConnected(false);
      }
    };

    connectRealtime();

    return () => {
      cancelled = true;

      if (channel) {
        import("@/lib/supabase")
          .then(({ supabase }) => {
            supabase.removeChannel(channel!);
          })
          .catch(() => {});
      }
    };
  }, [loadStats]);

  /*
   * Fallback refresh.
   *
   * If Supabase Realtime is temporarily unavailable,
   * the dashboard still stays current.
   */
  useEffect(() => {
    const interval = window.setInterval(() => {
      loadStats();
    }, 10000);

    return () => {
      window.clearInterval(interval);
    };
  }, [loadStats]);

  const utilization =
    stats.total > 0 ? Math.round((stats.used / stats.total) * 100) : 0;

  const availablePercentage =
    stats.total > 0 ? Math.round((stats.unused / stats.total) * 100) : 0;

  return (
    <main className={styles.page}>
      {/* HEADER */}

      <header className={styles.header}>
        <Link href="/" className={styles.logo} aria-label="EntryPass home">
          ENTRY<span>PASS</span>
        </Link>

        <nav className={styles.nav} aria-label="Main navigation">
          <Link href="/admin/scanner">Scanner</Link>

          <Link href="/admin/tickets" className={styles.activeNav}>
            Tickets
          </Link>
        </nav>
      </header>

      {/* MAIN */}

      <section className={styles.main}>
        <div className={styles.eyebrow}>TICKET MANAGEMENT</div>

        <h1 className={styles.title}>Tickets, at a glance.</h1>

        <p className={styles.subtitle}>
          Monitor your event inventory and entry status in real time.
        </p>

        {/* TOTAL */}

        <section className={styles.totalSection}>
          <span className={styles.totalLabel}>TOTAL TICKETS</span>

          <div className={styles.totalNumber}>
            {loading ? (
              <span className={styles.loadingNumber}>—</span>
            ) : (
              stats.total.toLocaleString("en-IN")
            )}
          </div>

          <div className={styles.totalMeta}>
            <span>{stats.single.toLocaleString("en-IN")} Single</span>

            <span>{stats.couple.toLocaleString("en-IN")} Couple</span>
          </div>
        </section>

        {/* STATS */}

        <section className={styles.statsGrid}>
          <article className={styles.stat}>
            <span>SINGLE ENTRY</span>

            <strong>
              {loading ? "—" : stats.single.toLocaleString("en-IN")}
            </strong>

            <small>Individual tickets</small>
          </article>

          <article className={styles.stat}>
            <span>COUPLE ENTRY</span>

            <strong>
              {loading ? "—" : stats.couple.toLocaleString("en-IN")}
            </strong>

            <small>Couple tickets</small>
          </article>

          <article className={styles.stat}>
            <span>AVAILABLE</span>

            <strong>
              {loading ? "—" : stats.unused.toLocaleString("en-IN")}
            </strong>

            <small>{availablePercentage}% of inventory</small>
          </article>

          <article className={styles.stat}>
            <span>SCANNED</span>

            <strong>
              {loading ? "—" : stats.used.toLocaleString("en-IN")}
            </strong>

            <small>{utilization}% entry completed</small>
          </article>
        </section>

        {/* ENTRY PROGRESS */}

        <section className={styles.progressSection}>
          <div className={styles.progressHeader}>
            <div>
              <span>EVENT ENTRY</span>

              <h2>{stats.used.toLocaleString("en-IN")} tickets scanned</h2>
            </div>

            <strong>{utilization}%</strong>
          </div>

          <div className={styles.progressTrack}>
            <div
              className={styles.progressFill}
              style={{
                width: `${utilization}%`,
              }}
            />
          </div>
        </section>

        {/* LIVE STATUS */}

        <section className={styles.liveSection}>
          <div className={styles.liveLeft}>
            <div
              className={`${styles.liveDot} ${
                realtimeConnected ? styles.connected : styles.disconnected
              }`}
            />

            <div>
              <strong>
                {realtimeConnected
                  ? "Live updates enabled"
                  : "Connecting to live updates"}
              </strong>

              <span>
                {realtimeConnected
                  ? "Changes appear automatically when a ticket is scanned."
                  : "Dashboard is using automatic refresh as fallback."}
              </span>
            </div>
          </div>

          <button
            type="button"
            className={styles.refreshButton}
            onClick={loadStats}
            aria-label="Refresh ticket statistics"
          >
            <RefreshIcon />
          </button>
        </section>

        {/* ERROR */}

        {error && (
          <div className={styles.error}>
            <strong>Unable to load ticket data</strong>

            <span>{error}</span>
          </div>
        )}

        {/* SCANNER CTA */}

        <Link href="/admin/scanner" className={styles.scannerCta}>
          <div>
            <span>EVENT ACCESS</span>

            <strong>Scan a ticket</strong>

            <small>Verify attendee entry at the gate.</small>
          </div>

          <ArrowIcon />
        </Link>

        {/* LAST UPDATED */}

        {lastUpdated && (
          <div className={styles.lastUpdated}>
            LAST UPDATED{" "}
            {new Date(lastUpdated).toLocaleTimeString("en-IN", {
              hour: "2-digit",
              minute: "2-digit",
              second: "2-digit",
            })}
          </div>
        )}
      </section>

      {/* FOOTER */}

      <footer className={styles.footer}>
        <span>
          ENTRY<span>PASS</span>
        </span>

        <span>Made by, Anirudh Sonawane</span>
      </footer>
    </main>
  );
}
