# Consumer examples

These examples demonstrate **consumer packages** using `@moyarich/vite-package-bin`, not additional bins published by the plugin itself.

- [Single-command CLI](single-command/) — a source filename that differs from its published executable name.
- [Multi-command CLI](multi-command/) — two independent executables in one npm package.

To try an example, supply `vite`, `typescript`, and `@moyarich/vite-package-bin` as development dependencies and run `vite build` in that package. The plugin is distributed through the registry configured in this repository.

Both examples specify `outDir: "dist/bin"` and explicit `sources` mappings. They produce standalone `.mjs` outputs without cross-command shared chunks.
