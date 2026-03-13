export const normalizeRole = (role?: string | null) => {
  if (!role) return null;
  const trimmed = role.trim();
  if (!trimmed) return null;
  return trimmed.replace(/^ROLE_/, "").replace(/_/g, "").toUpperCase();
};

export const isSuperAdminRole = (role?: string | null) =>
  normalizeRole(role) === "SUPERADMIN";
