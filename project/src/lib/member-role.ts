// Sem dependências de servidor: também é importado por componentes de cliente.
export const MEMBER_ROLES = ["admin", "massage_therapist", "receptionist"] as const;
export type MemberRole = (typeof MEMBER_ROLES)[number];
// O dono não é um membro: vem de Workspace.userId e não pode ser editado nem removido.
export type WorkspaceRole = "owner" | MemberRole;

export function canManageMembers(role: WorkspaceRole | null) {
  return role === "owner" || role === "admin";
}

// Quem atende os clientes pelas Conversas (WhatsApp e Instagram).
export function canUseInbox(role: WorkspaceRole | null) {
  return role === "owner" || role === "admin" || role === "receptionist";
}
