import { beforeEach, expect, test, vi } from "vitest";

const { build, chmod, copyFile, glob, mkdir, readFile, rm } = vi.hoisted(() => ({
  build: vi.fn(),
  chmod: vi.fn(),
  copyFile: vi.fn(),
  glob: vi.fn(),
  mkdir: vi.fn(),
  readFile: vi.fn(),
  rm: vi.fn(),
}));

vi.mock("node:fs/promises", async (importOriginal) => ({
  ...(await importOriginal<typeof import("node:fs/promises")>()),
  chmod,
  copyFile,
  glob,
  mkdir,
  readFile,
  rm,
}));

vi.mock("vite", async (importOriginal) => ({
  ...(await importOriginal<typeof import("vite")>()),
  build,
}));

import type { ResolvedConfig } from "vite";
import { packageBinBuild } from "../src/packageBinBuild.ts";

beforeEach(() => {
  vi.clearAllMocks();
  glob.mockImplementation((pattern: string) => {
    return (async function* () {
      if (pattern === "src/**/*.ts") yield "src/release.ts";
      if (pattern === "src/cli/**/*.sh") yield "src/cli/install.sh";
    })();
  });
  readFile.mockImplementation(async (path: unknown) => {
    const value = String(path);
    if (value.endsWith("package.json")) {
      return JSON.stringify({
        bin: {
          release: "./dist/bin/release.mjs",
          install: "./dist/bin/install.sh",
        },
      });
    }
    if (value.endsWith("src/release.ts")) {
      return "#!/usr/bin/env node\nconsole.log('release');\n";
    }
    throw new Error(`Unexpected read: ${value}`);
  });
  build.mockResolvedValue({});
  copyFile.mockResolvedValue(undefined);
  mkdir.mockResolvedValue(undefined);
  rm.mockResolvedValue(undefined);
});

test("builds Node package bins and copies shell package bins", async () => {
  const plugin = packageBinBuild({
    emptyOutDir: true,
    outDir: "dist/bin",
    validate: false,
  });
  const configResolved =
    typeof plugin.configResolved === "function"
      ? plugin.configResolved
      : plugin.configResolved?.handler;
  expect(configResolved).toBeTypeOf("function");
  await configResolved?.call(
    {} as never,
    {
      root: "/repo",
      logLevel: "silent",
    } as ResolvedConfig,
  );

  const buildStart =
    typeof plugin.buildStart === "function"
      ? plugin.buildStart
      : plugin.buildStart?.handler;
  expect(buildStart).toBeTypeOf("function");
  await buildStart?.call({} as never, {} as never);

  expect(glob).toHaveBeenCalledWith("src/**/*.ts", { cwd: "/repo" });
  expect(glob).toHaveBeenCalledWith("src/cli/**/*.sh", { cwd: "/repo" });
  expect(rm).toHaveBeenCalledWith("/repo/dist/bin", {
    recursive: true,
    force: true,
  });
  expect(build).toHaveBeenCalledTimes(1);
  expect(build).toHaveBeenCalledWith(
    expect.objectContaining({
      logLevel: "silent",
      build: expect.objectContaining({ outDir: "/repo/dist/bin" }),
    }),
  );
  expect(chmod).toHaveBeenCalledWith("/repo/dist/bin/release.mjs", 0o755);
  expect(mkdir).toHaveBeenCalledWith("/repo/dist/bin", { recursive: true });
  expect(copyFile).toHaveBeenCalledWith(
    "/repo/src/cli/install.sh",
    "/repo/dist/bin/install.sh",
  );
  expect(chmod).toHaveBeenCalledWith("/repo/dist/bin/install.sh", 0o755);
});

test("does not write an empty coordinator build to Vite's default dist", async () => {
  const plugin = packageBinBuild({
    emptyOutDir: true,
    outDir: "dist/bin",
    validate: false,
  });
  const config =
    typeof plugin.config === "function"
      ? plugin.config
      : plugin.config?.handler;
  expect(config).toBeTypeOf("function");
  const result = await config?.call({} as never, {} as never, {} as never);
  expect(result).toEqual(
    expect.objectContaining({
      build: expect.objectContaining({ write: false, emptyOutDir: false }),
    }),
  );
});
