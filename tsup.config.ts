import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/server.ts"],
  format: ["esm"], // 🔥 IMPORTANT
  target: "node18",
  outDir: "dist",
  sourcemap: true,
  clean: true,
  dts: false,
  splitting: false,
  shims: true,
  // Add this banner to shim require() for CJS dependencies
  banner: {
    js: `
      import { createRequire } from 'module';
      const require = createRequire(import.meta.url);
    `,
  },
});
