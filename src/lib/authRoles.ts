const ADMIN_ROLES = new Set(["admin", "owner"]);

function normalizeRoleValue(value: unknown) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

export function hasAdminRole(appMetadata: unknown) {
  if (!appMetadata || typeof appMetadata !== "object") return false;

  const metadata = appMetadata as {
    role?: unknown;
    roles?: unknown;
    app_role?: unknown;
  };

  const directRoles = [metadata.role, metadata.app_role].map(normalizeRoleValue);
  if (directRoles.some((role) => ADMIN_ROLES.has(role))) {
    return true;
  }

  if (Array.isArray(metadata.roles)) {
    return metadata.roles.some((role) => ADMIN_ROLES.has(normalizeRoleValue(role)));
  }

  return false;
}
