import path from "node:path";

// Shared path for the storage state produced by `e2e/auth.setup.ts` (the "setup"
// Playwright project) and consumed by any spec that needs an already-authenticated
// admin session (via `test.use({ storageState: ADMIN_STORAGE_STATE })`).
export const ADMIN_STORAGE_STATE = path.join(__dirname, ".auth/admin.json");
