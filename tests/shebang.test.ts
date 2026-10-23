import assert from "node:assert/strict";
import { chmod, mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "vitest";
import {
  standaloneCliBuilds,
  validatePackageBins,
} from "../src/packageBinBuild.ts";

test("adds a Node shebang only when the source is missing one", async () => {
  const root = await mkdtemp(join(tmpdir(), "package-bin-build-"));
  try {
    const withShebang = join(root, "with-shebang.ts");
    const withoutShebang = join(root, "without-shebang.ts");
    await writeFile(withShebang, "#!/usr/bin/env node\nconsole.log('with');\n");
    await writeFile(withoutShebang, "console.log('without');\n");
    const builds = standaloneCliBuilds(
      {
        "with-shebang": withShebang,
        "without-shebang": withoutShebang,
      },
      {},
      root,
    );
    for (const { name, config } of builds) {
      const output = config.build?.rollupOptions?.output;
      assert.ok(output && !Array.isArray(output));
      assert.equal(typeof output.banner, "function");
      if (typeof output.banner !== "function")
        throw new TypeError("Expected Rollup banner to be a function.");
      const banner = await output.banner({} as never);
      assert.equal(
        banner,
        name === "with-shebang" ? "" : "#!/usr/bin/env node",
      );
    }
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("validation detects missing shebangs and permits valid executable bins", async () => {
  const root = await mkdtemp(join(tmpdir(), "bins-"));
  try {
    await mkdir(join(root, "dist/bin"), { recursive: true });
    const binary = join(root, "dist/bin/tool.mjs");
    await writeFile(binary, "console.log('tool');");
    await chmod(binary, 0o755);
    await assert.rejects(
      () => validatePackageBins({ tool: "./dist/bin/tool.mjs" }, root),
      /no shebang/,
    );
    await writeFile(binary, "#!/usr/bin/env node\nconsole.log('tool');");
    await validatePackageBins({ tool: "./dist/bin/tool.mjs" }, root);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
