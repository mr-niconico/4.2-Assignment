import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Lets tests import app code with the same "@/..." paths the app uses.
export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./", import.meta.url)) },
  },
  test: {
    include: ["tests/**/*.test.ts"],
  },
});
