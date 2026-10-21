import { chmod, copyFile, glob, mkdir, readFile, rm, stat } from "node:fs/promises";
import { basename, dirname, extname, isAbsolute, relative, resolve, sep } from "node:path";

import type { InlineConfig, Plugin, ResolvedConfig } from "vite";
import { build } from "vite";

export interface PackageBinEntry {
  pattern: string;
  bin?: string;
}

export interface PackageBinBuildOptions {
  entries?: PackageBinEntry | PackageBinEntry[];
  /** Exact source paths indexed by package.json bin command name. */
  sources?: Record<string, string>;
  emptyOutDir: boolean;
  outDir?: string;
  target?: string;
  sourcemap?: boolean;
  minify?: boolean;
  external?: Array<string | RegExp>;
  /** Validate every declared bin entry after building (default: true). */
  validate?: boolean;
}

export interface StandaloneCliBuild {
  name: string;
  config: InlineConfig;
}

type PackageBins = Record<string, string>;

const managedBinExtensions = new Set([".js", ".mjs", ".cjs", ".sh"]);

const defaultEntries: PackageBinEntry[] = [
  { pattern: "src/**/*.ts" },
  { pattern: "src/cli/**/*.sh", bin: "./bin/{name}.sh" },
];

export async function readManagedPackageBins(root: string): Promise<PackageBins> {
  const pkg = JSON.parse(await readFile(resolve(root, "package.json"), "utf8")) as {
    name?: string;
    bin?: string | PackageBins;
  };
  if (!pkg.bin) return {};
  if (typeof pkg.bin === "string") {
    const name = pkg.name?.split("/").at(-1);
    if (!name) throw new Error("package.json#name is required for a string bin");
    return { [name]: pkg.bin };
  }
  return Object.fromEntries(
    Object.entries(pkg.bin).sort(([a], [b]) => a.localeCompare(b)),
  );
}

export async function discoverCliEntries(
  entryOptions: PackageBinBuildOptions["entries"] = defaultEntries,
  root = process.cwd(),
  bins?: PackageBins,
  defaultBinPattern = "./bin/{name}.mjs",
  sources: Record<string, string> = {},
): Promise<Record<string, string>> {
  const entryRules = (
    Array.isArray(entryOptions) ? entryOptions : [entryOptions]
  ).map((entry) => ({ bin: defaultBinPattern, ...entry }));
  const managedBins = bins ?? (await readManagedPackageBins(root));
  const candidates = new Map<string, string[]>();
  for (const [name, source] of Object.entries(sources)) {
    if (!(name in managedBins)) {
      throw new Error(`Source mapping "${name}" is not declared in package.json#bin`);
    }
    const sourcePath = resolve(root, source);
    if (!withinRoot(root, sourcePath)) throw new Error(`Source path escapes package root: ${source}`);
    if (!(await stat(sourcePath).catch(() => null))?.isFile()) {
      throw new Error(`CLI source not found: ${source}`);
    }
    candidates.set(name, [sourcePath]);
  }
  for (const entryRule of entryRules) {
    for await (const entry of glob(entryRule.pattern, { cwd: root })) {
      const name = basename(entry).replace(/\.[^.]+$/, "");
      const expectedBin = entryRule.bin.replaceAll("{name}", name);
      if (name in sources || managedBins[name] !== expectedBin) continue;
      const matches = candidates.get(name) ?? [];
      matches.push(resolve(root, entry));
      candidates.set(name, matches);
    }
  }
  const entries: Record<string, string> = {};
  for (const name of Object.keys(managedBins)) {
    const matches = [...new Set(candidates.get(name) ?? [])];
    if (matches.length === 0) throw new Error(`No source entry matched package bin "${name}"`);
    if (matches.length > 1) {
      throw new Error([
        `Package bin source collision for "${name}".`,
        ...matches.map((match) => `  - ${match}`),
        "",
        "Each package bin must resolve to exactly one source file.",
        'Narrow packageBinBuild({ entries: { pattern: "..." } }) to the directory containing executable entry points.',
        'For example: entries: { pattern: "src/cli/**/*.ts" }',
      ].join("\n"));
    }
    entries[name] = matches[0];
  }
  return entries;
}

function withinRoot(root: string, path: string): boolean {
  const rel = relative(resolve(root), resolve(path));
  return rel !== ".." && !rel.startsWith(`..${sep}`) && !isAbsolute(rel);
}

function destinationFor(root: string, destination: string): string {
  const path = resolve(root, destination);
  if (!withinRoot(root, path) || resolve(root) === path) {
    throw new Error(`Invalid package bin destination: ${destination}`);
  }
  return path;
}

export async function validatePackageBins(bins: PackageBins, root = process.cwd()): Promise<void> {
  for (const [name, destination] of Object.entries(bins)) {
    const path = destinationFor(root, destination);
    const info = await stat(path).catch(() => null);
    if (!info?.isFile()) throw new Error(`Package bin "${name}" missing: ${destination}`);
    if (!(info.mode & 0o111)) throw new Error(`Package bin "${name}" is not executable: ${destination}`);
    const source = await readFile(path, "utf8");
    if (!source.startsWith("#!")) throw new Error(`Package bin "${name}" has no shebang: ${destination}`);
  }
}

export function standaloneCliBuilds(
  entries: Record<string, string>,
  options: Omit<PackageBinBuildOptions, "entries" | "emptyOutDir"> = {},
  root = process.cwd(),
  bins?: PackageBins,
): StandaloneCliBuild[] {
  const {
    outDir = "bin",
    target = "node24",
    sourcemap = false,
    minify = false,
    external = [],
  } = options;
  return Object.entries(entries).map(([name, entry]) => {
    const destination = bins?.[name] ?? `./${outDir}/${name}.mjs`;
    const output = destinationFor(root, destination);
    if (!managedBinExtensions.has(extname(output)) || extname(output) === ".sh") {
      throw new Error(`Node CLI "${name}" needs a .js, .mjs or .cjs bin destination`);
    }
    return {
      name,
      config: {
        root,
        configFile: false,
        build: {
          target,
          outDir: dirname(output),
          emptyOutDir: false,
          sourcemap,
          minify,
          lib: {
            entry,
            formats: [extname(output) === ".cjs" ? "cjs" : "es"],
            fileName: () => basename(output),
          },
          rollupOptions: {
            external: [/^node:/, ...external],
            output: {
              async banner() {
                const source = await readFile(entry, "utf8");
                return source.startsWith("#!") ? "" : "#!/usr/bin/env node";
              },
              entryFileNames: basename(output),
              codeSplitting: false,
            },
          },
        },
      },
    };
  });
}

/**
 * Copies shell CLI sources to their package bin destinations and makes them
 * executable without passing them through Vite.
 */
export async function copyShellCliEntries(
  entries: Record<string, string>,
  bins: PackageBins,
  root = process.cwd(),
): Promise<void> {
  for (const [name, entry] of Object.entries(entries)) {
    const destination = bins[name];
    if (!destination) continue;
    const outputPath = destinationFor(root, destination);
    await mkdir(dirname(outputPath), { recursive: true });
    await copyFile(entry, outputPath);
    await chmod(outputPath, 0o755);
  }
}

/**
 * Vite plugin that builds Node.js package bins as independent executables and
 * copies shell package bins as executable scripts.
 */
export function packageBinBuild(options: PackageBinBuildOptions): Plugin {
  const virtualEntry = "\0moyarich:package-bin-build";
  let resolvedConfig: ResolvedConfig;
  return {
    name: "moyarich:package-bin-build",
    enforce: "pre",
    config() {
      return {
        build: {
          write: false,
          emptyOutDir: false,
          rollupOptions: {
            input: virtualEntry,
            onwarn(warning, warn) {
              if (warning.code === "EMPTY_BUNDLE" && warning.message.includes("package-bin-build")) return;
              warn(warning);
            },
          },
        },
      };
    },
    resolveId(id) {
      if (id === virtualEntry) return virtualEntry;
    },
    load(id) {
      if (id === virtualEntry) return "export {}";
    },
    configResolved(config) {
      resolvedConfig = config;
    },
    async buildStart() {
      const root = resolvedConfig.root;
      const bins = await readManagedPackageBins(root);
      const outDir = options.outDir ?? "bin";
      const entryOptions = options.entries ?? [
        { pattern: "src/**/*.ts", bin: `./${outDir}/{name}.mjs` },
        { pattern: "src/cli/**/*.sh", bin: `./${outDir}/{name}.sh` },
      ];
      const entries = await discoverCliEntries(
        entryOptions, root, bins, `./${outDir}/{name}.mjs`, options.sources,
      );
      if (Object.keys(entries).length === 0) throw new Error("No managed package bins were found");
      if (options.emptyOutDir) {
        const outputRoot = destinationFor(root, outDir);
        for (const [name, destination] of Object.entries(bins)) {
          const path = destinationFor(root, destination);
          if (path !== outputRoot && !path.startsWith(`${outputRoot}${sep}`)) {
            throw new Error(`Bin "${name}" is outside emptyOutDir target: ${destination}`);
          }
        }
        await rm(outputRoot, { recursive: true, force: true });
      }
      const shellEntries = Object.fromEntries(
        Object.entries(entries).filter(([, entry]) => extname(entry) === ".sh"),
      );
      const nodeEntries = Object.fromEntries(
        Object.entries(entries).filter(([, entry]) => extname(entry) !== ".sh"),
      );
      const {
        entries: _entries, sources: _sources, validate: _validate,
        emptyOutDir: _emptyOutDir, ...buildOptions
      } = options;
      for (const { name, config } of standaloneCliBuilds(nodeEntries, buildOptions, root, bins)) {
        await build({ ...config, logLevel: resolvedConfig.logLevel });
        await chmod(destinationFor(root, bins[name]), 0o755);
      }
      await copyShellCliEntries(shellEntries, bins, root);
      if (options.validate !== false) await validatePackageBins(bins, root);
    },
    generateBundle(_outputOptions, bundle) {
      for (const fileName of Object.keys(bundle)) delete bundle[fileName];
    },
  };
}
