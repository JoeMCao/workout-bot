"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

const STORAGE_KEY = "workout_bot_dashboard_api_key";

/** `YYYY-MM-DD` → UTC ISO for WHOOP `start` (local midnight). */
function localDateToStartIso(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  if (!y || !m || !d) throw new Error("Invalid date");
  return new Date(y, m - 1, d, 0, 0, 0, 0).toISOString();
}

/** `YYYY-MM-DD` → UTC ISO for WHOOP `end` (local end of day). */
function localDateToEndIso(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  if (!y || !m || !d) throw new Error("Invalid date");
  return new Date(y, m - 1, d, 23, 59, 59, 999).toISOString();
}

type SyncResponse = {
  sync?: {
    fetched: number;
    inserted: number;
    updated: number;
    skipped: number;
    needsReview: number;
  };
  backfill?: { eligible: number; created: number };
  whoop?: unknown;
  error?: { message: string; code?: string; details?: unknown };
};

export function WhoopSyncPanel({
  whoopConnected
}: {
  whoopConnected: boolean;
}) {
  const router = useRouter();
  const [apiKey, setApiKey] = useState("");
  const [remember, setRemember] = useState(false);
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<SyncResponse | null>(null);
  /** Local calendar day; optional WHOOP `start` filter (inclusive, local midnight). */
  const [syncFromDate, setSyncFromDate] = useState("");
  /** Local calendar day; optional WHOOP `end` filter (inclusive, local end of day). */
  const [syncThroughDate, setSyncThroughDate] = useState("");

  function loadStoredKey() {
    if (typeof window === "undefined") return;
    const s = sessionStorage.getItem(STORAGE_KEY);
    if (s) setApiKey(s);
  }

  async function handleSync() {
    const key = apiKey.trim();
    if (!key) {
      setStatus("error");
      setMessage("Enter your WORKOUT_API_KEY (same as GPT / API calls).");
      return;
    }

    if (syncFromDate && syncThroughDate && syncFromDate > syncThroughDate) {
      setStatus("error");
      setMessage('"From" date must be on or before "Through" date.');
      return;
    }

    if (remember && typeof window !== "undefined") {
      sessionStorage.setItem(STORAGE_KEY, key);
    } else if (typeof window !== "undefined") {
      sessionStorage.removeItem(STORAGE_KEY);
    }

    setStatus("loading");
    setMessage(null);
    setLastResult(null);

    try {
      const body: {
        maxPages: number;
        start?: string;
        end?: string;
      } = { maxPages: 10 };

      if (syncFromDate.trim()) {
        body.start = localDateToStartIso(syncFromDate.trim());
      }
      if (syncThroughDate.trim()) {
        body.end = localDateToEndIso(syncThroughDate.trim());
      }

      const res = await fetch("/api/whoop/sync-and-backfill", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": key
        },
        body: JSON.stringify(body)
      });

      const data = (await res.json()) as SyncResponse;

      if (!res.ok) {
        setStatus("error");
        setMessage(
          data.error?.message ??
            `Request failed (${res.status}). Check WORKOUT_API_KEY and WHOOP connection.`
        );
        setLastResult(data);
        return;
      }

      setStatus("done");
      setLastResult(data);
      const s = data.sync;
      const b = data.backfill;
      setMessage(
        s && b
          ? `WHOOP: fetched ${s.fetched}, inserted ${s.inserted}, updated ${s.updated}, skipped ${s.skipped}. Strength shells: ${b.created} created (${b.eligible} eligible).`
          : "Sync completed."
      );
      router.refresh();
    } catch (e) {
      setStatus("error");
      setMessage(e instanceof Error ? e.message : "Network error");
    }
  }

  return (
    <div style={{ marginTop: 16 }}>
      <p className="muted" style={{ marginBottom: 8 }}>
        Pull WHOOP workouts into ActivitySessions, then run the strength shell backfill
        (links orphan WorkoutSessions to placeholder activities for matching). Dates use{" "}
        <strong>this browser&apos;s local timezone</strong> (start of day / end of day).
      </p>
      {!whoopConnected ? (
        <p className="muted" style={{ marginBottom: 8 }}>
          Connect WHOOP above first.
        </p>
      ) : null}
      <div style={{ display: "flex", flexDirection: "column", gap: 8, maxWidth: 420 }}>
        <label className="muted" style={{ fontSize: 13 }}>
          WORKOUT_API_KEY
          <input
            type="password"
            autoComplete="off"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            onFocus={loadStoredKey}
            placeholder="Same key as curl / GPT x-api-key"
            style={{
              display: "block",
              width: "100%",
              marginTop: 4,
              padding: "8px 10px",
              borderRadius: 6,
              border: "1px solid var(--border, #ccc)"
            }}
          />
        </label>
        <label className="muted" style={{ fontSize: 13, display: "flex", gap: 8, alignItems: "center" }}>
          <input
            type="checkbox"
            checked={remember}
            onChange={(e) => setRemember(e.target.checked)}
          />
          Remember in this browser tab (sessionStorage only)
        </label>
        <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 4 }}>
          <label className="muted" style={{ fontSize: 13 }}>
            From (optional)
            <input
              type="date"
              value={syncFromDate}
              onChange={(e) => setSyncFromDate(e.target.value)}
              style={{
                display: "block",
                width: "100%",
                marginTop: 4,
                padding: "8px 10px",
                borderRadius: 6,
                border: "1px solid var(--border, #ccc)"
              }}
            />
            <span className="row-meta" style={{ display: "block", marginTop: 4, fontSize: 11 }}>
              Only workouts starting on or after this local day. Empty = WHOOP default window.
            </span>
          </label>
          <label className="muted" style={{ fontSize: 13 }}>
            Through (optional)
            <input
              type="date"
              value={syncThroughDate}
              onChange={(e) => setSyncThroughDate(e.target.value)}
              style={{
                display: "block",
                width: "100%",
                marginTop: 4,
                padding: "8px 10px",
                borderRadius: 6,
                border: "1px solid var(--border, #ccc)"
              }}
            />
            <span className="row-meta" style={{ display: "block", marginTop: 4, fontSize: 11 }}>
              Only workouts ending before the next local day. Empty = now (WHOOP default).
            </span>
          </label>
        </div>
        <button
          type="button"
          className="button"
          disabled={status === "loading" || !whoopConnected}
          onClick={() => void handleSync()}
        >
          {status === "loading" ? "Syncing…" : "Sync WHOOP workouts"}
        </button>
      </div>
      {message ? (
        <p
          className="row-meta"
          style={{
            marginTop: 12,
            color: status === "error" ? "#b91c1c" : undefined
          }}
        >
          {message}
        </p>
      ) : null}
      {lastResult?.error?.details ? (
        <pre
          className="row-meta"
          style={{
            marginTop: 8,
            fontSize: 11,
            overflow: "auto",
            maxHeight: 160,
            background: "var(--card-bg, #f5f5f5)",
            padding: 8,
            borderRadius: 6
          }}
        >
          {JSON.stringify(lastResult.error.details, null, 2)}
        </pre>
      ) : null}
    </div>
  );
}
