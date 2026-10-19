import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));

function wrangler(args, { capture = false } = {}) {
  const result = spawnSync(
    process.execPath,
    [resolve(root, "node_modules/wrangler/bin/wrangler.js"), ...args],
    {
      cwd: root,
      env: { ...process.env, CI: "true", WRANGLER_SEND_METRICS: "false" },
      encoding: "utf8",
      stdio: capture ? ["ignore", "pipe", "inherit"] : "inherit",
      maxBuffer: 10 * 1024 * 1024,
    },
  );
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`Wrangler no pudo completar: ${args.join(" ")}`);
  }
  return result.stdout;
}

export async function deployCloudflare({
  projectRoot = root,
  run = wrangler,
} = {}) {
  const configPath = resolve(projectRoot, "dist/server/wrangler.json");
  const config = JSON.parse(await readFile(configPath, "utf8"));
  if (config.d1_databases?.length) {
    throw new Error("Este despliegue utiliza Google Sheets. Vuelve a compilar sin bindings D1.");
  }
  await run(["deploy", "--config", configPath]);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  deployCloudflare().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
