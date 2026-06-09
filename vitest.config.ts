import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "node",
    setupFiles: ["./vitest.setup.ts"],
    env: { NEXT_PUBLIC_DEVICE_MODE: "mirror" },
  },
  resolve: { alias: { "@": path.resolve(__dirname, ".") } },
});
