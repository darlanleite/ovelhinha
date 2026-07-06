import { createLovableConfig } from "lovable-agent-playwright-config/config";

export default createLovableConfig({
  // E2E fica separado dos testes unitários do Vitest (src/test)
  testDir: "./tests/e2e",
  use: {
    baseURL: "http://localhost:8080",
  },
});
