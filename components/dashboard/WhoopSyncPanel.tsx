"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

const STORAGE_KEY = "workout_bot_dashboard_api_key";

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

    if (remember && typeof window !== "undefined") {
      sessionStorage.setItem(STORAGE_KEY, key);
    } else if (typeof window !== "undefined") {
      sessionStorage.removeItem(STORAGE_KEY);
    }

    setStatus("loading");
    setMessage(null);
    setLastResult(null);

    try {
      const res = await fetch("/api/whoop/sync-and-backfill", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": key
        },
        body: JSON.stringify({ maxPages: 10 })
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
        Pull latest WHOOP workouts into ActivitySessions, then run the strength shell backfill
        (links orphan WorkoutSessions to placeholder activities for matching).
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
        <button
          type="button"
          className="button"
          disabled={status === "loading" || !whoopConnected}
          onClick={() => void handleSync()}
        >
          {status === "loading" ? "Syncing…" : "Sync latest WHOOP workouts"}
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
