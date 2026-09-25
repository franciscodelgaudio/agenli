import { createHash } from "node:crypto";
import { describe, it, expect, vi } from "vitest";
import {
  acceptInvite,
  canManageMembers,
  inviteMember,
  removeMember,
  updateMember,
} from "@/lib/member";

const WORKSPACE_ID = "64b7f0c2a1b2c3d4e5f60718";
const USER_ID = "64b7f0c2a1b2c3d4e5f60719";
const MEMBER_ID = "64b7f0c2a1b2c3d4e5f60721";
const NOW = new Date("2026-09-24T12:00:00.000Z");
const IN_7_DAYS = new Date("2026-10-01T12:00:00.000Z");

const sha256 = (value: string) => createHash("sha256").update(value).digest("hex");

describe("canManageMembers", () => {
  it.each([
    ["owner", true],
    ["admin", true],
    ["massage_therapist", false],
    ["receptionist", false],
    [null, false],
  ] as const)("%s → %s", (role, expected) => {
    expect(canManageMembers(role)).toBe(expected);
  });
});

describe("inviteMember", () => {
  function makeDeps(overrides: Partial<Parameters<typeof inviteMember>[2]> = {}) {
    const deps = {
      isAlreadyInWorkspace: vi.fn().mockResolvedValue(false),
      createInvite: vi.fn().mockResolvedValue({ id: MEMBER_ID }),
      deleteInvite: vi.fn().mockResolvedValue(undefined),
      sendInvite: vi.fn().mockResolvedValue(undefined),
      now: () => NOW,
    };
    return { ...deps, ...overrides } as typeof deps;
  }

  it("cria o convite, envia o email com o token e retorna o id", async () => {
    const deps = makeDeps();

    const result = await inviteMember(
      { email: "maria@example.com", role: "receptionist" },
      { workspaceId: WORKSPACE_ID, actorRole: "owner" },
      deps,
    );

    expect(result).toEqual({ ok: true, memberId: MEMBER_ID });
    expect(deps.sendInvite).toHaveBeenCalledWith({
      email: "maria@example.com",
      token: expect.any(String),
    });
    const { token } = deps.sendInvite.mock.calls[0][0];
    // Só o hash do token vai para o banco; o token em si só existe no email.
    expect(deps.createInvite).toHaveBeenCalledWith({
      workspaceId: WORKSPACE_ID,
      email: "maria@example.com",
      role: "receptionist",
      tokenHash: sha256(token),
      expiresAt: IN_7_DAYS,
    });
    expect(token).not.toBe(sha256(token));
  });

  it("gera um token diferente a cada convite, com pelo menos 32 caracteres", async () => {
    const deps = makeDeps();
    const ctx = { workspaceId: WORKSPACE_ID, actorRole: "owner" } as const;

    await inviteMember({ email: "a@example.com", role: "admin" }, ctx, deps);
    await inviteMember({ email: "b@example.com", role: "admin" }, ctx, deps);

    const [first, second] = deps.sendInvite.mock.calls.map(([data]) => data.token);
    expect(first.length).toBeGreaterThanOrEqual(32);
    expect(first).not.toBe(second);
  });

  it("normaliza o email (espaços e maiúsculas) antes de verificar e salvar", async () => {
    const deps = makeDeps();

    await inviteMember(
      { email: "  Maria@Example.COM  ", role: "admin" },
      { workspaceId: WORKSPACE_ID, actorRole: "admin" },
      deps,
    );

    expect(deps.isAlreadyInWorkspace).toHaveBeenCalledWith("maria@example.com");
    expect(deps.createInvite).toHaveBeenCalledWith(expect.objectContaining({ email: "maria@example.com" }));
    expect(deps.sendInvite).toHaveBeenCalledWith(expect.objectContaining({ email: "maria@example.com" }));
  });

  it.each(["admin", "massage_therapist", "receptionist"])("aceita a função %s", async (role) => {
    const result = await inviteMember(
      { email: "maria@example.com", role },
      { workspaceId: WORKSPACE_ID, actorRole: "owner" },
      makeDeps(),
    );

    expect(result).toEqual({ ok: true, memberId: MEMBER_ID });
  });

  it("retorna workspace_not_found sem fazer nada quando o usuário não tem acesso", async () => {
    const deps = makeDeps();

    const result = await inviteMember(
      { email: "maria@example.com", role: "admin" },
      { workspaceId: WORKSPACE_ID, actorRole: null },
      deps,
    );

    expect(result).toEqual({ ok: false, error: "workspace_not_found" });
    expect(deps.isAlreadyInWorkspace).not.toHaveBeenCalled();
    expect(deps.createInvite).not.toHaveBeenCalled();
    expect(deps.sendInvite).not.toHaveBeenCalled();
  });

  it.each(["massage_therapist", "receptionist"] as const)(
    "retorna forbidden sem fazer nada quando quem convida é %s",
    async (actorRole) => {
      const deps = makeDeps();

      const result = await inviteMember(
        { email: "maria@example.com", role: "admin" },
        { workspaceId: WORKSPACE_ID, actorRole },
        deps,
      );

      expect(result).toEqual({ ok: false, error: "forbidden" });
      expect(deps.createInvite).not.toHaveBeenCalled();
      expect(deps.sendInvite).not.toHaveBeenCalled();
    },
  );

  it.each([
    ["input nulo", null, "invalid_input"],
    ["email ausente", { role: "admin" }, "invalid_input"],
    ["email não é string", { email: 123, role: "admin" }, "invalid_input"],
    ["email vazio", { email: "", role: "admin" }, "invalid_email"],
    ["email sem @", { email: "maria.example.com", role: "admin" }, "invalid_email"],
    ["email sem domínio", { email: "maria@", role: "admin" }, "invalid_email"],
    ["função ausente", { email: "maria@example.com" }, "invalid_role"],
    ["função desconhecida", { email: "maria@example.com", role: "manager" }, "invalid_role"],
    ["função owner", { email: "maria@example.com", role: "owner" }, "invalid_role"],
  ])("retorna erro sem salvar nem enviar quando %s", async (_label, input, error) => {
    const deps = makeDeps();

    const result = await inviteMember(input, { workspaceId: WORKSPACE_ID, actorRole: "owner" }, deps);

    expect(result).toEqual({ ok: false, error });
    expect(deps.createInvite).not.toHaveBeenCalled();
    expect(deps.sendInvite).not.toHaveBeenCalled();
  });

  it("retorna already_member sem salvar nem enviar quando o email já está no workspace", async () => {
    const deps = makeDeps({ isAlreadyInWorkspace: vi.fn().mockResolvedValue(true) });

    const result = await inviteMember(
      { email: "maria@example.com", role: "admin" },
      { workspaceId: WORKSPACE_ID, actorRole: "owner" },
      deps,
    );

    expect(result).toEqual({ ok: false, error: "already_member" });
    expect(deps.createInvite).not.toHaveBeenCalled();
    expect(deps.sendInvite).not.toHaveBeenCalled();
  });

  it("apaga o convite e retorna email_failed quando o envio do email falha", async () => {
    const deps = makeDeps({ sendInvite: vi.fn().mockRejectedValue(new Error("resend down")) });

    const result = await inviteMember(
      { email: "maria@example.com", role: "admin" },
      { workspaceId: WORKSPACE_ID, actorRole: "owner" },
      deps,
    );

    expect(result).toEqual({ ok: false, error: "email_failed" });
    expect(deps.deleteInvite).toHaveBeenCalledWith(MEMBER_ID);
  });
});

describe("acceptInvite", () => {
  const TOKEN = "a".repeat(43);
  const USER = { id: USER_ID, email: "maria@example.com" };

  function makeInvite(overrides = {}) {
    return {
      id: MEMBER_ID,
      workspaceId: WORKSPACE_ID,
      email: "maria@example.com",
      expiresAt: IN_7_DAYS,
      ...overrides,
    };
  }

  function makeDeps(invite: ReturnType<typeof makeInvite> | null = makeInvite()) {
    return {
      findInviteByTokenHash: vi.fn().mockResolvedValue(invite),
      markAccepted: vi.fn().mockResolvedValue(undefined),
      now: () => NOW,
    };
  }

  it("busca o convite pelo hash do token, vincula o usuário e retorna o workspace", async () => {
    const deps = makeDeps();

    const result = await acceptInvite(TOKEN, USER, deps);

    expect(result).toEqual({ ok: true, workspaceId: WORKSPACE_ID });
    expect(deps.findInviteByTokenHash).toHaveBeenCalledWith(sha256(TOKEN));
    expect(deps.markAccepted).toHaveBeenCalledWith(MEMBER_ID, USER_ID);
  });

  it("compara o email sem diferenciar maiúsculas", async () => {
    const result = await acceptInvite(TOKEN, { id: USER_ID, email: "Maria@Example.com" }, makeDeps());

    expect(result).toEqual({ ok: true, workspaceId: WORKSPACE_ID });
  });

  it("retorna unauthenticated sem buscar o convite quando não há usuário", async () => {
    const deps = makeDeps();

    const result = await acceptInvite(TOKEN, null, deps);

    expect(result).toEqual({ ok: false, error: "unauthenticated" });
    expect(deps.findInviteByTokenHash).not.toHaveBeenCalled();
  });

  it.each([
    ["token vazio", ""],
    ["token não é string", 123],
    ["token ausente", undefined],
  ])("retorna invalid_invite sem buscar quando %s", async (_label, token) => {
    const deps = makeDeps();

    const result = await acceptInvite(token, USER, deps);

    expect(result).toEqual({ ok: false, error: "invalid_invite" });
    expect(deps.findInviteByTokenHash).not.toHaveBeenCalled();
  });

  it("retorna invalid_invite quando o token não corresponde a um convite pendente", async () => {
    const deps = makeDeps(null);

    const result = await acceptInvite(TOKEN, USER, deps);

    expect(result).toEqual({ ok: false, error: "invalid_invite" });
    expect(deps.markAccepted).not.toHaveBeenCalled();
  });

  it("retorna invite_expired sem aceitar quando o convite venceu", async () => {
    const deps = makeDeps(makeInvite({ expiresAt: NOW }));

    const result = await acceptInvite(TOKEN, USER, deps);

    expect(result).toEqual({ ok: false, error: "invite_expired" });
    expect(deps.markAccepted).not.toHaveBeenCalled();
  });

  it("retorna email_mismatch sem aceitar quando o usuário logado tem outro email", async () => {
    const deps = makeDeps();

    const result = await acceptInvite(TOKEN, { id: USER_ID, email: "joao@example.com" }, deps);

    expect(result).toEqual({ ok: false, error: "email_mismatch" });
    expect(deps.markAccepted).not.toHaveBeenCalled();
  });
});

describe("updateMember", () => {
  function makeDeps(member: { id: string; userId: string | null } | null = { id: MEMBER_ID, userId: USER_ID }) {
    return {
      findMember: vi.fn().mockResolvedValue(member),
      update: vi.fn().mockResolvedValue(undefined),
    };
  }

  it("atualiza nome e função de um membro que já aceitou", async () => {
    const deps = makeDeps();

    const result = await updateMember(
      { name: "  Maria Souza  ", role: "massage_therapist" },
      MEMBER_ID,
      { actorRole: "admin" },
      deps,
    );

    expect(result).toEqual({ ok: true });
    expect(deps.findMember).toHaveBeenCalledWith(MEMBER_ID);
    expect(deps.update).toHaveBeenCalledWith(MEMBER_ID, { name: "Maria Souza", role: "massage_therapist" });
  });

  it("atualiza só a função de um convite pendente (ainda sem conta vinculada)", async () => {
    const deps = makeDeps({ id: MEMBER_ID, userId: null });

    const result = await updateMember(
      { name: "Ignorado", role: "admin" },
      MEMBER_ID,
      { actorRole: "owner" },
      deps,
    );

    expect(result).toEqual({ ok: true });
    expect(deps.update).toHaveBeenCalledWith(MEMBER_ID, { role: "admin" });
  });

  it("retorna workspace_not_found sem buscar quando o usuário não tem acesso", async () => {
    const deps = makeDeps();

    const result = await updateMember({ name: "Maria", role: "admin" }, MEMBER_ID, { actorRole: null }, deps);

    expect(result).toEqual({ ok: false, error: "workspace_not_found" });
    expect(deps.findMember).not.toHaveBeenCalled();
    expect(deps.update).not.toHaveBeenCalled();
  });

  it.each(["massage_therapist", "receptionist"] as const)(
    "retorna forbidden sem salvar quando quem edita é %s",
    async (actorRole) => {
      const deps = makeDeps();

      const result = await updateMember({ name: "Maria", role: "admin" }, MEMBER_ID, { actorRole }, deps);

      expect(result).toEqual({ ok: false, error: "forbidden" });
      expect(deps.update).not.toHaveBeenCalled();
    },
  );

  it.each([undefined, null, ""])(
    "retorna member_not_found sem buscar quando não há memberId (%j)",
    async (memberId) => {
      const deps = makeDeps();

      const result = await updateMember({ name: "Maria", role: "admin" }, memberId, { actorRole: "owner" }, deps);

      expect(result).toEqual({ ok: false, error: "member_not_found" });
      expect(deps.findMember).not.toHaveBeenCalled();
    },
  );

  it("retorna member_not_found quando o membro não existe (ou não é do workspace)", async () => {
    const deps = makeDeps(null);

    const result = await updateMember({ name: "Maria", role: "admin" }, MEMBER_ID, { actorRole: "owner" }, deps);

    expect(result).toEqual({ ok: false, error: "member_not_found" });
    expect(deps.update).not.toHaveBeenCalled();
  });

  it.each([
    ["input nulo", null, "invalid_input"],
    ["função ausente", { name: "Maria" }, "invalid_role"],
    ["função desconhecida", { name: "Maria", role: "manager" }, "invalid_role"],
    ["função owner", { name: "Maria", role: "owner" }, "invalid_role"],
    ["nome ausente", { role: "admin" }, "invalid_input"],
    ["nome não é string", { name: 123, role: "admin" }, "invalid_input"],
    ["nome só com espaços", { name: "   ", role: "admin" }, "invalid_name"],
    ["nome com mais de 80 caracteres", { name: "a".repeat(81), role: "admin" }, "name_too_long"],
  ])("retorna erro sem salvar quando %s", async (_label, input, error) => {
    const deps = makeDeps();

    const result = await updateMember(input, MEMBER_ID, { actorRole: "owner" }, deps);

    expect(result).toEqual({ ok: false, error });
    expect(deps.update).not.toHaveBeenCalled();
  });
});

describe("removeMember", () => {
  it("remove o membro (ou convite) do workspace", async () => {
    const remove = vi.fn().mockResolvedValue(true);

    const result = await removeMember(MEMBER_ID, { actorRole: "admin" }, remove);

    expect(result).toEqual({ ok: true });
    expect(remove).toHaveBeenCalledWith(MEMBER_ID);
  });

  it("retorna workspace_not_found sem remover quando o usuário não tem acesso", async () => {
    const remove = vi.fn().mockResolvedValue(true);

    const result = await removeMember(MEMBER_ID, { actorRole: null }, remove);

    expect(result).toEqual({ ok: false, error: "workspace_not_found" });
    expect(remove).not.toHaveBeenCalled();
  });

  it.each(["massage_therapist", "receptionist"] as const)(
    "retorna forbidden sem remover quando quem remove é %s",
    async (actorRole) => {
      const remove = vi.fn().mockResolvedValue(true);

      const result = await removeMember(MEMBER_ID, { actorRole }, remove);

      expect(result).toEqual({ ok: false, error: "forbidden" });
      expect(remove).not.toHaveBeenCalled();
    },
  );

  it.each([undefined, null, ""])(
    "retorna member_not_found sem remover quando não há memberId (%j)",
    async (memberId) => {
      const remove = vi.fn().mockResolvedValue(true);

      const result = await removeMember(memberId, { actorRole: "owner" }, remove);

      expect(result).toEqual({ ok: false, error: "member_not_found" });
      expect(remove).not.toHaveBeenCalled();
    },
  );

  it("retorna member_not_found quando o membro não existe (ou não é do workspace)", async () => {
    const result = await removeMember(MEMBER_ID, { actorRole: "owner" }, vi.fn().mockResolvedValue(false));

    expect(result).toEqual({ ok: false, error: "member_not_found" });
  });
});
