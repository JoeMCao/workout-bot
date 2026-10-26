import { requireApiKey } from "@/lib/auth";
import { createWorkoutMcpHandler } from "@/lib/mcp/server";
import { READ_SCOPE, WRITE_SCOPE } from "@/lib/plugin-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Existing key-authenticated clients keep their current endpoint and access.
const handler = createWorkoutMcpHandler([READ_SCOPE, WRITE_SCOPE]);
async function authenticatedHandler(request: Request) {
  const authError = requireApiKey(request);
  if (authError) return authError;
  return handler(request);
}
export { authenticatedHandler as GET, authenticatedHandler as POST, authenticatedHandler as DELETE };
