import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { deployCloudflare } from "../scripts/deploy-cloudflare.mjs";

const uuid = "12345678-1234-4234-8234-123456789abc";

async function fixture(t, databaseId) {
  const root = await mkdtemp(join(tmpdir(), "aula-cloudflare-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const path = join(root, "dist/server/wrangler.json");
  await mkdir(join(root, "dist/server"), { recursive: true });
  await mkdir(join(root, "drizzle"));
  await writeFile(path, JSON.stringify({
    name: "aula-ia",
    main: "index.js",
    assets: { directory: "../client" },
    d1_databases: [{ binding: "DB", database_name: "aula-ia-db", database_id: databaseId }],
  }));
  return { root, path };
}

test("reuses an existing database and migrates its real ID before publishing", async (t) => {
  const { root, path } = await fixture(t);
  const calls = [];
  await deployCloudflare({ projectRoot: root, run: async (args) => {
    calls.push(args);
    if (args[1] === "list") return JSON.stringify([{ name: "aula-ia-db", uuid }]);
    const config = JSON.parse(await readFile(path, "utf8"));
    assert.equal(config.d1_databases[0].database_id, uuid);
    assert.equal(resolve(join(root, "dist/server"), config.d1_databases[0].migrations_dir), join(root, "drizzle"));
    assert.equal(config.assets.directory, "../client");
  } });
  assert.deepEqual(calls.map((args) => args.slice(0, 3)), [
    ["d1", "list", "--json"],
    ["d1", "migrations", "apply"],
    ["deploy", "--config", path],
  ]);
});

test("creates a missing database and resolves its real ID from Cloudflare", async (t) => {
  const { root, path } = await fixture(t);
  let created = false;
  await deployCloudflare({ projectRoot: root, run: async (args) => {
    if (args[1] === "list") return JSON.stringify(created ? [{ name: "aula-ia-db", uuid }] : []);
    if (args[1] === "create") {
      assert.deepEqual(args, ["d1", "create", "aula-ia-db", "--no-update-config"]);
      created = true;
    }
  } });
  assert.ok(created);
  assert.equal(JSON.parse(await readFile(path, "utf8")).d1_databases[0].database_id, uuid);
});

test("honors an explicitly configured database without listing or creating one", async (t) => {
  const { root } = await fixture(t, uuid);
  const calls = [];
  await deployCloudflare({ projectRoot: root, run: async (args) => calls.push(args) });
  assert.equal(calls.length, 2);
  assert.deepEqual(calls[0].slice(0, 3), ["d1", "migrations", "apply"]);
});

test("does not publish when migration or database permissions fail", async (t) => {
  for (const failAt of ["list", "migrations"]) {
    const { root } = await fixture(t);
    const calls = [];
    await assert.rejects(deployCloudflare({ projectRoot: root, run: async (args) => {
      calls.push(args);
      if (args[1] === failAt) throw new Error("D1 access denied");
      if (args[1] === "list") return JSON.stringify([{ name: "aula-ia-db", uuid }]);
    } }), /D1 access denied/);
    assert.ok(!calls.some((args) => args[0] === "deploy"));
  }
});

test("rejects the original fictitious database ID before contacting Cloudflare", async (t) => {
  const { root } = await fixture(t, "00000000-0000-4000-8000-000000000000");
  await assert.rejects(deployCloudflare({ projectRoot: root, run: () => assert.fail("Unexpected call") }), /ID de ejemplo/);
});
