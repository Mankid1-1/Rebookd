import { expect, test, describe, vi } from "vitest";
import { appRouter } from "../routers";

// Mock TRPC Context Dependencies
const mockCtx = {
  req: {} as any,
  res: { cookie: vi.fn(), clearCookie: vi.fn() } as any,
  user: { id: 1, email: "test@example.com", auth: "mock", role: "user" } as any,
  db: null as any,
};

describe("TRPC Integration Tests", () => {
  test("getSystemErrors admin endpoint rejects non-admins", async () => {
    // Override context to have role = user instead of admin
    const caller = appRouter.createCaller({ ...mockCtx, user: { ...mockCtx.user, role: "user" } });
    
    await expect(caller.admin.systemHealth.errors()).rejects.toThrow(/FORBIDDEN|permission/i);
  });
});
