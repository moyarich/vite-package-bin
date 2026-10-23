import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "vitest";
import {
  discoverCliEntries,
  standaloneCliBuilds,
} from "../src/packageBinBuild.ts";

test("explicit mappings use command names rather than source basenames", async () => {
  const root = await mkdtemp(join(tmpdir(), "bins-"));
  try {
    await mkdir(join(root, "src/commands"), { recursive: true });
    await writeFile(join(root, "src/commands/main.ts"), "export {};");
    const entries = await discoverCliEntries(
      [],
      root,
      {
        "workflows-cli": "./dist/bin/workflows-cli.mjs",
      },
      "./dist/bin/{name}.mjs",
      {
        "workflows-cli": "src/commands/main.ts",
      },
    );
    assert.equal(entries["workflows-cli"], join(root, "src/commands/main.ts"));
    const builds = standaloneCliBuilds(entries, {}, root, {
      "workflows-cli": "./dist/bin/workflows-cli.mjs",
    });
    assert.equal(builds[0].config.build?.outDir, join(root, "dist/bin"));
    const output = builds[0].config.build?.rollupOptions?.output;
    assert.ok(output && !Array.isArray(output));
    assert.equal(output.entryFileNames, "workflows-cli.mjs");
    await assert.rejects(
      () =>
        discoverCliEntries([], root, { foo: "./bin/foo.mjs" }, undefined, {
          bar: "src/commands/main.ts",
        }),
      /not declared/,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
