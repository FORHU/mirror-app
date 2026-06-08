import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    environment: "node",
    env: { NEXT_PUBLIC_DEVICE_MODE: "mirror" },
  },
  resolve: { alias: { "@": path.resolve(__dirname, ".") } },
});
