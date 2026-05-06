import { json } from "@/lib/http";
import { buildOpenApiSpec } from "@/lib/openapi";

function resolveOpenApiBaseUrl(request: Request) {
  const fromEnv =
    process.env.OPENAPI_PUBLIC_URL?.trim() ||
    process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (fromEnv) {
    try {
      return new URL(fromEnv).origin;
    } catch {
      // fall through to request origin
    }
  }
  return new URL(request.url).origin;
}

export async function GET(request: Request) {
  return json(buildOpenApiSpec(resolveOpenApiBaseUrl(request)));
}
