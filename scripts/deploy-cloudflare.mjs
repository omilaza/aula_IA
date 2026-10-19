import { spawnSync } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const PLACEHOLDER_ID = "00000000-0000-4000-8000-000000000000";
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
  const binding = config.d1_databases?.find(({ binding }) => binding === "DB");
  if (!binding?.database_name || binding.database_id === PLACEHOLDER_ID) {
    throw new Error("Configura DB con una base D1 real; no uses el ID de ejemplo de Sites.");
  }

  if (!binding.database_id) {
    const listDatabases = async () => {
      const databases = JSON.parse(await run(["d1", "list", "--json"], { capture: true }));
      if (!Array.isArray(databases)) throw new Error("Respuesta D1 inesperada.");
      return databases;
    };
    let database = (await listDatabases()).find(({ name }) => name === binding.database_name);
    if (!database) {
      await run(["d1", "create", binding.database_name, "--no-update-config"]);
      database = (await listDatabases()).find(({ name }) => name === binding.database_name);
    }
    if (!database?.uuid) throw new Error("No se pudo obtener el ID de la base D1.");
    binding.database_id = database.uuid;
  }

  // Vite emits this config under dist/server. Resolve migrations from the source
  // directory explicitly; Wrangler in CI does not write provisioned IDs back.
  binding.migrations_dir = relative(dirname(configPath), resolve(projectRoot, "drizzle"));
  await writeFile(configPath, `${JSON.stringify(config, null, 2)}\n`);

  // Fail before publishing if D1 or its schema cannot be prepared.
  await run(["d1", "migrations", "apply", "DB", "--remote", "--config", configPath]);
  await run(["deploy", "--config", configPath]);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  deployCloudflare().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
