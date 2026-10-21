import { defineConfig } from "vite";
import { packageBinBuild } from "@moyarich/vite-package-bin";

export default defineConfig({
  plugins: [packageBinBuild({
    emptyOutDir: true,
    outDir: "dist/bin",
    sources: { "hello-cli": "src/main.ts" },
  })],
});
