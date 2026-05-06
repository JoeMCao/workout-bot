import { WHOOP_API_BASE_URL } from "./config";
import { WhoopSyncError } from "./sync-error";
import type { WhoopSyncLogEvent } from "./sync-log";

type SyncLogFn = (event: WhoopSyncLogEvent) => void;

const WHOOP_OPENAPI_SERVER_ORIGIN = "https://api.prod.whoop.com/developer";

function assertWhoopDataApiBaseMatchesOpenApi() {
  const normalized = WHOOP_API_BASE_URL.replace(/\/$/, "");
  if (normalized !== WHOOP_OPENAPI_SERVER_ORIGIN) {
    throw new WhoopSyncError(
      "WHOOP_CONFIG_INVALID",
      `WHOOP_API_BASE_URL must be ${WHOOP_OPENAPI_SERVER_ORIGIN} per WHOOP OpenAPI; got ${normalized}`,
      503
    );
  }
}

function whoopResponseHeadersForLog(headers: Headers) {
  const pick = [
    "content-type",
    "www-authenticate",
    "x-request-id",
    "cf-ray",
    "server"
  ] as const;
  const out: Record<string, string> = {};
  for (const k of pick) {
    const v = headers.get(k);
    if (v) out[k] = v;
  }
  return out;
}

function httpStatusForWhoopApi(status: number) {
  if (status === 401 || status === 403 || status === 429) return status;
  return 502;
}

function whoopQueryInstant(value: string) {
  const ms = new Date(value).getTime();
  if (Number.isNaN(ms)) {
    throw new WhoopSyncError(
      "WHOOP_QUERY_DATETIME_INVALID",
      `Invalid WHOOP query datetime: ${value}`,
      400
    );
  }
  return new Date(ms).toISOString();
}

export type WhoopCollectionPage = {
  records: unknown[];
  next_token?: string;
};

export async function fetchWhoopCollectionPage({
  accessToken,
  path,
  start,
  end,
  nextToken,
  limit = 25,
  page,
  log,
  whoopConnectionContext,
  resource
}: {
  accessToken: string;
  path: string;
  start?: string;
  end?: string;
  nextToken?: string;
  limit?: number;
  page?: number;
  log?: SyncLogFn;
  whoopConnectionContext?: {
    connectionScope: string | null;
    resource: "sleep" | "recovery";
  };
  resource: "sleep" | "recovery";
}) {
  assertWhoopDataApiBaseMatchesOpenApi();
  const url = new URL(`${WHOOP_API_BASE_URL.replace(/\/$/, "")}${path}`);
  url.searchParams.set("limit", String(Math.min(limit, 25)));
  if (start) url.searchParams.set("start", whoopQueryInstant(start));
  if (end) url.searchParams.set("end", whoopQueryInstant(end));
  if (nextToken) url.searchParams.set("nextToken", nextToken);

  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });

  const body = await response.json().catch(() => null);

  if (!response.ok) {
    log?.({
      phase: "whoop_health_http",
      resource,
      requestUrl: url.toString(),
      page: page ?? null,
      ok: false,
      status: response.status,
      responseHeaders: whoopResponseHeadersForLog(response.headers),
      responseBody: body,
      ...(whoopConnectionContext
        ? {
            connectionScope: whoopConnectionContext.connectionScope,
            resource: whoopConnectionContext.resource
          }
        : {})
    });
    throw new WhoopSyncError(
      "WHOOP_FETCH_FAILED",
      `WHOOP ${resource} API returned ${response.status}`,
      httpStatusForWhoopApi(response.status),
      {
        requestUrl: url.toString(),
        httpStatus: response.status,
        body,
        resource,
        responseHeaders: whoopResponseHeadersForLog(response.headers)
      }
    );
  }

  const payload = body as WhoopCollectionPage & { nextToken?: string };
  const records = payload.records ?? [];
  const next_page = payload.next_token ?? payload.nextToken ?? undefined;

  log?.({
    phase: "whoop_health_http",
    resource,
    requestUrl: url.toString(),
    page: page ?? null,
    ok: true,
    status: response.status,
    recordCount: records.length,
    hasNextToken: Boolean(next_page)
  });

  return { records, next_token: next_page };
}

export function fetchWhoopSleepsPage(args: Omit<Parameters<typeof fetchWhoopCollectionPage>[0], "path" | "resource">) {
  return fetchWhoopCollectionPage({ ...args, path: "/v2/activity/sleep", resource: "sleep" });
}

export function fetchWhoopRecoveriesPage(
  args: Omit<Parameters<typeof fetchWhoopCollectionPage>[0], "path" | "resource">
) {
  return fetchWhoopCollectionPage({ ...args, path: "/v2/recovery", resource: "recovery" });
}
