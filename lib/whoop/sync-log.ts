export type WhoopSyncLogEvent = {
  phase: string;
  [key: string]: unknown;
};

export type WhoopSyncLogContext = {
  /** Optional client-supplied id (e.g. header); DB is single-tenant WHOOP today. */
  userId: string | null;
  requestId?: string;
};

export function createWhoopSyncLogger(ctx: WhoopSyncLogContext) {
  return (event: WhoopSyncLogEvent) => {
    const line = {
      ts: new Date().toISOString(),
      service: "whoop_sync",
      userId: ctx.userId,
      requestId: ctx.requestId,
      ...event
    };
    console.log(JSON.stringify(line));
  };
}
