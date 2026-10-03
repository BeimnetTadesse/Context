import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Same "@/…" import alias as tsconfig.json, so tests can import app code directly.
export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL(".", import.meta.url)) } },
});
