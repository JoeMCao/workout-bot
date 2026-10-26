import { handlePluginMcp } from "@/lib/plugin-http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = (request: Request) => handlePluginMcp(request);
export const GET = POST;
export const DELETE = POST;
