import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "vitest";
import { discoverCliEntries } from "../src/packageBinBuild.ts";

test("finds managed bins across multiple source locations", async () => {
  const root = await mkdtemp(join(tmpdir(), "package-bin-build-"));
  try {
    await mkdir(join(root, "src/release"), { recursive: true });
    await mkdir(join(root, "scripts/diagnostics"), { recursive: true });
    await writeFile(join(root, "src/release/release.ts"), "export {};");
    await writeFile(join(root, "scripts/diagnostics/doctor.ts"), "export {};");
    const entries = await discoverCliEntries(
      [{ pattern: "src/**/*.ts" }, { pattern: "scripts/**/*.ts" }],
      root,
      { release: "./bin/release.mjs", doctor: "./bin/doctor.mjs" },
    );
    assert.deepEqual(
      new Set(Object.keys(entries)),
      new Set(["doctor", "release"]),
    );
    assert.equal(entries.release, join(root, "src/release/release.ts"));
    assert.equal(entries.doctor, join(root, "scripts/diagnostics/doctor.ts"));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("ignores source files that are not managed package bins", async () => {
  const root = await mkdtemp(join(tmpdir(), "package-bin-build-"));
  try {
    await mkdir(join(root, "src"), { recursive: true });
    await writeFile(join(root, "src/release.ts"), "export {};");
    await writeFile(join(root, "src/helper.ts"), "export {};");
    const entries = await discoverCliEntries({ pattern: "src/**/*.ts" }, root, {
      release: "./bin/release.mjs",
    });
    assert.deepEqual(Object.keys(entries), ["release"]);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
