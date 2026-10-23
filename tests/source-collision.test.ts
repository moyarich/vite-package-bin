import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "vitest";
import { discoverCliEntries } from "../src/packageBinBuild.ts";

test("reports source collisions with troubleshooting guidance", async () => {
  const root = await mkdtemp(join(tmpdir(), "package-bin-build-"));
  try {
    await mkdir(join(root, "src/cli"), { recursive: true });
    await writeFile(join(root, "src/release.ts"), "export {};");
    await writeFile(join(root, "src/cli/release.ts"), "export {};");
    await assert.rejects(
      () =>
        discoverCliEntries({ pattern: "src/**/*.ts" }, root, {
          release: "./bin/release.mjs",
        }),
      (error: Error) => {
        assert.match(
          error.message,
          /Package bin source collision for "release"/,
        );
        assert.match(error.message, /src\/release\.ts/);
        assert.match(error.message, /src\/cli\/release\.ts/);
        assert.match(error.message, /src\/cli\/\*\*\/\*\.ts/);
        return true;
      },
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
