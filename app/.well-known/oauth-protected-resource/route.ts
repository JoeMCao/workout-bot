import { PluginAuthError, pluginConfig, resourceMetadata } from "@/lib/plugin-auth";

export const dynamic = "force-dynamic";

export function GET() {
  try {
    return Response.json(resourceMetadata(pluginConfig()), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return Response.json({ error: "Workout Buddy plugin is not configured." }, {
      status: error instanceof PluginAuthError ? error.status : 503,
      headers: { "Cache-Control": "no-store" }
    });
  }
}
