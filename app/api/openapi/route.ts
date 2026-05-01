import { requireApiKey } from "@/lib/auth";
import { json } from "@/lib/http";
import { buildOpenApiSpec } from "@/lib/openapi";

export async function GET(request: Request) {
  const authError = requireApiKey(request);
  if (authError) return authError;

  const origin = new URL(request.url).origin;

  return json(buildOpenApiSpec(origin));
}
