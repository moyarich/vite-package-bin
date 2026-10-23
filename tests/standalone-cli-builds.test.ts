import assert from "node:assert/strict";
import { test } from "vitest";
import { standaloneCliBuilds } from "../src/packageBinBuild.ts";

test("creates one independent build per CLI entry", () => {
  const builds = standaloneCliBuilds(
    {
      alpha: "/repo/src/cli/alpha.ts",
      beta: "/repo/src/cli/beta.ts",
    },
    {},
    "/repo",
  );
  assert.deepEqual(
    builds.map(({ name }) => name),
    ["alpha", "beta"],
  );
  for (const { name, config } of builds) {
    assert.equal(config.configFile, false);
    assert.equal(config.build?.emptyOutDir, false);
    assert.equal(config.build?.outDir, "/repo/bin");
    const output = config.build?.rollupOptions?.output;
    assert.ok(output && !Array.isArray(output));
    assert.equal(output.codeSplitting, false);
    assert.equal(output.entryFileNames, `${name}.mjs`);
    assert.equal("chunkFileNames" in output, false);
  }
});

test("preserves CLI build options", () => {
  const [build] = standaloneCliBuilds(
    { demo: "/repo/demo.ts" },
    {
      outDir: "dist/bin",
      target: "node24",
      sourcemap: true,
      minify: true,
      external: ["commander"],
    },
    "/repo",
  );
  assert.equal(build.config.build?.outDir, "/repo/dist/bin");
  assert.equal(build.config.build?.target, "node24");
  assert.equal(build.config.build?.sourcemap, true);
  assert.equal(build.config.build?.minify, true);
  const external = build.config.build?.rollupOptions?.external;
  assert.ok(Array.isArray(external));
  assert.equal(external.at(-1), "commander");
});
