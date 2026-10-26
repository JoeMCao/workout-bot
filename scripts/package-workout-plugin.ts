import { cp, mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { spawnSync } from "node:child_process";

async function main() {
  const root = process.cwd();
  // The repository is public. Personal health context stays local, then goes
  // only into the owner's private ChatGPT package, never Git.
  for (const file of ["mcp-coaching.md", "coaching-policy.md"]) {
    const source = path.join(root, "plugins/workout-buddy/skills/workout-buddy/references", file);
    try { await readFile(source, "utf8"); }
    catch { throw new Error(`Missing private coaching reference: ${file}. See docs/WORKOUT_PLUGIN_SETUP.md.`); }
  }
  if (process.argv.includes("--chatgpt")) {
    // Keep the existing registered app and its OAuth connection when updating
    // the ChatGPT package. A standalone MCP package would create another link.
    const registration = JSON.parse(
      await readFile(
        path.join(root, "plugins/workout-buddy/chatgpt-registration.json"),
        "utf8",
      ),
    );
    const source = JSON.parse(
      await readFile(path.join(root, "plugins/workout-buddy/plugin.json"), "utf8"),
    );
    await mkdir(path.join(root, "dist"), { recursive: true });
    const output = await mkdtemp(path.join(root, "dist", "workout-buddy-chatgpt-"));
    await mkdir(path.join(output, ".codex-plugin"));
    await cp(
      path.join(root, "plugins/workout-buddy/skills"),
      path.join(output, "skills"),
      { recursive: true },
    );
    await writeFile(
      path.join(output, ".app.json"),
      JSON.stringify(
        {
          apps: { [registration.name]: { id: registration.appId } },
        },
        null,
        2,
      ) + "\n",
    );
    await writeFile(
      path.join(output, ".codex-plugin/plugin.json"),
      JSON.stringify(
        {
          name: registration.name,
          version: registration.version,
          description: source.description,
          author: source.author,
          interface: source.extensions["com.openai"].interface,
          apps: "./.app.json",
          skills: "./skills/",
        },
        null,
        2,
      ) + "\n",
    );
    const zip = `${output}.zip`;
    const result = spawnSync(
      "zip",
      ["-qr", zip, ".codex-plugin", ".app.json", "skills"],
      { cwd: output, stdio: "inherit" },
    );
    if (result.status !== 0) throw new Error("Could not create ChatGPT ZIP.");
    console.log(`ChatGPT plugin update: ${zip}`);
    return;
  }
  const args = Object.fromEntries(
    process.argv.slice(2).map((a) => {
      const index = a.indexOf("=");
      return [a.slice(0, index), a.slice(index + 1)];
    }),
  );
  const resource = new URL(args["--resource"] ?? "");
  if (
    resource.protocol !== "https:" ||
    resource.pathname !== "/api/plugin/mcp" ||
    resource.username ||
    resource.password ||
    resource.search ||
    resource.hash
  )
    throw new Error(
      "Provide --resource=https://YOUR-WORKOUT-HOST/api/plugin/mcp without credentials or query parameters.",
    );
  const clientId = args["--client-id"];
  if (!clientId?.trim())
    throw new Error(
      "Provide --client-id=YOUR_REGISTERED_OAUTH_CLIENT_ID (not a secret).",
    );
  await mkdir(path.join(root, "dist"), { recursive: true });
  const output = await mkdtemp(path.join(root, "dist", "workout-buddy-plugin-"));
  await cp(path.join(root, "plugins", "workout-buddy"), output, { recursive: true });
  await writeFile(
    path.join(output, "mcp.json"),
    JSON.stringify(
      {
        $schema: "https://agent-plugins.org/schemas/1.0.0/mcp.schema.json",
        mcpServers: {
          "workout-buddy": {
            type: "streamable-http",
            url: resource.toString(),
            extensions: {
              "com.openai": {
                auth: {
                  type: "oauth",
                  resource: resource.toString(),
                  baseScopes: [
                    "workout:read",
                    "workout:write",
                    "offline_access",
                  ],
                  client: {
                    mode: "provided",
                    clientId,
                    tokenEndpointAuthMethod: "client_secret_post",
                  },
                },
              },
            },
          },
        },
      },
      null,
      2,
    ) + "\n",
  );
  // Only the public manifest, skill and connection metadata enter the archive.
  // Never copy a repository, .env, project files or credentials into a plugin.
  const manifest = JSON.parse(
    await readFile(path.join(output, "plugin.json"), "utf8"),
  );
  if (manifest.name !== "workout-buddy")
    throw new Error("Unexpected plugin manifest.");
  const zip = `${output}.zip`;
  const result = spawnSync(
    "zip",
    ["-qr", zip, "plugin.json", "mcp.json", "skills"],
    { cwd: output, stdio: "inherit" },
  );
  if (result.status !== 0)
    throw new Error("Could not create ZIP; the package directory is ready.");
  console.log(`Plugin package: ${zip}`);
}
main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
