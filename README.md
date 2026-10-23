# @moyarich/vite-plugin-package-bin

Build Node.js command-line executables declared in `package.json#bin` using Vite. Each command receives its own bundle at the exact path specified by the manifest. Shell executable entries can be copied alongside them.

## Installation

```sh
npm install -D @moyarich/vite-plugin-package-bin vite typescript
```

This repository configures publishing to GitHub Packages. Configure your npm registry/authentication accordingly.

## Quick start

Declare the command(s) in your application's `package.json`:

```json
{
  "name": "@example/toolkit",
  "type": "module",
  "bin": {
    "toolkit": "./dist/bin/toolkit.mjs",
    "check-dist": "./dist/bin/check-dist.mjs"
  },
  "scripts": { "build": "vite build" }
}
```

Create `src/commands/toolkit.ts`:

```ts
#!/usr/bin/env node
import { Command } from "commander";

const program = new Command();
program.name("toolkit").description("Example CLI").version("1.0.0");
program.command("hello").action(() => console.log("Hello!"));
program.parse();
```

Create `src/commands/check-dist.ts` as another executable entry point, then configure `vite.config.ts`:

```ts
import { defineConfig } from "vite";
import { packageBinBuild } from "@moyarich/vite-plugin-package-bin";

export default defineConfig({
  plugins: [
    packageBinBuild({
      emptyOutDir: true,
      outDir: "dist/bin",
      sources: {
        toolkit: "src/commands/toolkit.ts",
        "check-dist": "src/commands/check-dist.ts",
      },
    }),
  ],
});
```

Run `npm run build` and then `node dist/bin/toolkit.mjs hello`. To expose executables with `npx`, publish/install the **consumer** package containing the `bin` declarations; `npx @example/toolkit` selects the package's executable when npm can determine a default bin.

## How entries are resolved

The `bin` field defines command names **and output paths**; `sources` maps those names to TypeScript/JavaScript source entry points. Explicit mappings are recommended when filenames differ from commands, or helpers share the same basename.

If `sources` is omitted, the plugin discovers entries by matching `package.json#bin` command names with source basenames. Default patterns are `src/**/*.ts` and `src/cli/**/*.sh`. Narrow discovery with `entries` to exclude unrelated files:

```ts
packageBinBuild({
  emptyOutDir: true,
  outDir: "dist/bin",
  entries: [
    { pattern: "src/commands/**/*.ts" },
    { pattern: "src/cli/**/*.sh", bin: "./dist/bin/{name}.sh" },
  ],
});
```

The default Node discovery template is `./<outDir>/{name}.mjs`. When using custom extension or destination paths, prefer explicit `sources`.

## Build behavior

- Node outputs support `.js`, `.mjs`, and `.cjs`; the output path comes from `package.json#bin`.
- Each Node command is built independently; shared chunks are **not** generated across CLI executables.
- Built-in `node:` imports are externalized; add other runtime external dependencies using `external`.
- Node executables get a `#!/usr/bin/env node` shebang unless their source already has one, and executable permissions.
- Shell files are copied without bundling and require their own shebang.
- `validate` defaults to `true` and checks that each bin exists, has executable permissions, and begins with a shebang.
- `emptyOutDir: true` removes the configured output directory first; every declared bin destination must be inside it.
- Source and output paths must stay within the project root.

GitHub Actions bundles and shared Action asset chunks are separate concerns; this plugin builds npm `bin` executables.

## Documentation

[Getting started](docs/01-getting-started/page.mdx) · [Building package bins](docs/02-guides/01-building-package-bins/page.mdx) · [API reference](docs/03-reference/01-package-bin-build/page.mdx) · [Examples](examples/README.md)

## Development

```sh
npm run build
npm run typecheck
npm run test
```

These are repository scripts; actual validation requires installing the project's dependencies.
