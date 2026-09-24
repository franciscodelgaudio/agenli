import type { WorkspaceRole } from "@/lib/member-role"

// Nomes das funções na interface; no código e no banco ficam em inglês.
export const roleLabels: Record<WorkspaceRole, string> = {
  owner: "Proprietário",
  admin: "Administrador",
  massage_therapist: "Massagista",
  receptionist: "Recepcionista",
}
