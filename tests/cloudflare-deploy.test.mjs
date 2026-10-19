import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { deployCloudflare } from "../scripts/deploy-cloudflare.mjs";

async function fixture(t, config) {
  const root = await mkdtemp(join(tmpdir(), "aula-cloudflare-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const path = join(root, "dist/server/wrangler.json");
  await mkdir(join(root, "dist/server"), { recursive: true });
  await writeFile(path, JSON.stringify(config));
  return { root, path };
}

test("Sheets deployment publishes the compiled Worker without any D1 operation", async (t) => {
  const { root, path } = await fixture(t, { name: "aula-ia", assets: { directory: "../client" } });
  const calls = [];
  await deployCloudflare({ projectRoot: root, run: async (args) => calls.push(args) });
  assert.deepEqual(calls, [["deploy", "--config", path]]);
});

test("a stale D1 build is rejected before it can provision a database", async (t) => {
  const { root } = await fixture(t, { d1_databases: [{ binding: "DB", database_name: "aula-ia-db" }] });
  await assert.rejects(deployCloudflare({ projectRoot: root, run: () => assert.fail("Unexpected publish") }), /sin bindings D1/);
});

test("publication failure propagates instead of claiming success", async (t) => {
  const { root } = await fixture(t, {});
  await assert.rejects(deployCloudflare({ projectRoot: root, run: () => { throw new Error("Worker access denied"); } }), /Worker access denied/);
});
