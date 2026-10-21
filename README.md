# @moyarich/vite-package-bin

Vite plugin for building `package.json#bin` entries as independent Node.js executables and copying executable shell scripts.

## Install and configure

```ts
import { defineConfig } from "vite";
import { packageBinBuild } from "@moyarich/vite-package-bin";

export default defineConfig({
  plugins: [packageBinBuild({
    emptyOutDir: true,
    outDir: "dist/bin",
    sources: {
      "reusable-workflows-cli": "src/commands/main.ts",
      "check-dist": "src/commands/check-dist.ts",
    },
  })],
});
```

```json
{
  "bin": {
    "reusable-workflows-cli": "./dist/bin/reusable-workflows-cli.mjs",
    "check-dist": "./dist/bin/check-dist.mjs"
  }
}
```

Every CLI builds independently to the exact destination declared by `package.json#bin` (supported extensions: `.js`, `.mjs`, `.cjs`). A string-valued `bin` is also supported, using the unscoped package name. The plugin adds a Node shebang unless the source supplies one and sets executable permissions.

## Discovery

Without `sources`, the plugin matches command names from `package.json#bin` to source basenames. Default source patterns are `src/**/*.ts` and `src/cli/**/*.sh`. Use `entries` to narrow source discovery:

```ts
packageBinBuild({
  entries: [
    { pattern: "src/cli/**/*.ts" },
    { pattern: "src/cli/**/*.sh", bin: "./dist/bin/{name}.sh" },
  ],
  emptyOutDir: true,
  outDir: "dist/bin",
});
```

Explicit `sources` override basename discovery for the specified commands and avoid accidental matches with shared helper modules. Every declared bin must resolve to exactly one source. Source collisions report matching paths.

Shell scripts are copied without Vite bundling, made executable (`0755`), and must supply their own shebang (e.g. `#!/usr/bin/env bash`).

## Output and validation

- CLI output extensions can be `.js`, `.mjs`, or `.cjs`.
- Command sources and destinations must remain within the package root.
- `emptyOutDir: true` clears `outDir` once and requires all declared bins to reside underneath it.
- Validation (default `true`) checks existence, executable permissions, and shebang for every declared bin.
- Configure `external`, `target`, `sourcemap`, and `minify` to customize Vite builds.
- Node built-ins (`node:`) are always externalized.
- Executables have independent builds with code splitting disabled.

GitHub Actions and reusable `_assets` chunks are a separate build responsibility; this plugin handles npm package executables only.

## Development

```bash
npm run build
npm run test
npm run typecheck
```
