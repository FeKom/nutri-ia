import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["tests/**/*.test.ts"],
    passWithNoTests: true,
    envFile: ".env.test",
    coverage: {
      include: ["src/mastra/tools/**", "src/mastra/clients/**"],
    },
  },
});
