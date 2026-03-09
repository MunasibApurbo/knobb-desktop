import { describe, expect, it } from "vitest";

import { hasAdminRole } from "@/lib/authRoles";

describe("hasAdminRole", () => {
  it("accepts admin in the role claim", () => {
    expect(hasAdminRole({ role: "admin" })).toBe(true);
  });

  it("accepts owner in a roles array", () => {
    expect(hasAdminRole({ roles: ["member", "owner"] })).toBe(true);
  });

  it("accepts app_role in mixed case", () => {
    expect(hasAdminRole({ app_role: "Admin" })).toBe(true);
  });

  it("rejects non-admin metadata", () => {
    expect(hasAdminRole({ role: "member", roles: ["listener"] })).toBe(false);
  });

  it("rejects missing metadata", () => {
    expect(hasAdminRole(null)).toBe(false);
  });
});
