import { defineConfig } from "vite";
import { packageBinBuild } from "@moyarich/vite-package-bin";

export default defineConfig({
  plugins: [packageBinBuild({
    emptyOutDir: true,
    outDir: "dist/bin",
    sources: {
      toolkit: "src/commands/main.ts",
      "check-dist": "src/commands/check-dist.ts",
    },
  })],
});
