import { json } from "@/lib/http";
import { buildOpenApiSpec } from "@/lib/openapi";

export async function GET(request: Request) {
  const origin = new URL(request.url).origin;

  return json(buildOpenApiSpec(origin));
}
