# Changelog

All notable changes to this project are documented here.

## Unreleased

### Documentation

- Standardize package naming as `@moyarich/vite-package-bin` across metadata, README, and guides.
- Add runnable-style multi-command and single-command consumer examples.
- Document exact `package.json#bin` destinations, explicit `sources`, shell handling, and output validation.
- Explain the standalone-bundle limitation: CLI builds do not share chunks.

## 0.1.0

### Added

- Vite plugin `packageBinBuild` for building declared Node.js package-bin executables.
- Package-bin source discovery, explicit command-to-source mappings, and collision detection.
- Independent bundles targeting `.js`, `.mjs`, and `.cjs` manifest destinations.
- Executable shebang and permissions handling, shell script copying, and distribution validation.
- External runtime dependency configuration.
