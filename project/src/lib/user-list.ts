import { MEMBER_ROLES, type WorkspaceRole } from "@/lib/member-role";
import { first, type SearchParams, type SortDir } from "@/lib/unit-list";

export const USER_PAGE_SIZE = 20;
const SORT_FIELDS = ["name", "email"] as const;
const ROLES: readonly WorkspaceRole[] = ["owner", ...MEMBER_ROLES];
// active: dono ou membro que aceitou; pending/expired: convite ainda sem conta.
const STATUSES = ["active", "pending", "expired"] as const;

export type UserSortField = (typeof SORT_FIELDS)[number];
export type UserStatus = (typeof STATUSES)[number];
// role/status vazios = todos.
export type UserListQuery = {
  q: string;
  sort: UserSortField;
  dir: SortDir;
  role: WorkspaceRole | "";
  status: UserStatus | "";
  page: number;
};

export type UserListItem = {
  id: string;
  name: string | null;
  email: string;
  image: string | null;
  role: WorkspaceRole;
  status: UserStatus;
};

export function parseUserListQuery(params: SearchParams): UserListQuery {
  const sort = first(params.sort);
  const role = first(params.role);
  const status = first(params.status);
  const page = first(params.page);
  return {
    q: first(params.q)?.trim() ?? "",
    sort: SORT_FIELDS.includes(sort as UserSortField) ? (sort as UserSortField) : "name",
    dir: first(params.dir) === "desc" ? "desc" : "asc",
    role: ROLES.includes(role as WorkspaceRole) ? (role as WorkspaceRole) : "",
    status: STATUSES.includes(status as UserStatus) ? (status as UserStatus) : "",
    page: page && /^[1-9]\d*$/.test(page) ? Number(page) : 1,
  };
}

// Minúsculas e sem acentos, para a busca.
function normalize(value: string) {
  return value.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
}

// Busca, filtros e ordenação sobre dono + membros (poucos por workspace), e a página pedida.
export function userListPage(people: UserListItem[], { q, sort, dir, role, status, page }: UserListQuery) {
  const term = normalize(q);
  const sortKey = (person: UserListItem) => (sort === "name" ? (person.name ?? person.email) : person.email);
  const filtered = people
    .filter(
      (person) =>
        (!role || person.role === role) &&
        (!status || person.status === status) &&
        (!term || normalize(person.name ?? "").includes(term) || normalize(person.email).includes(term)),
    )
    .sort((a, b) => sortKey(a).localeCompare(sortKey(b), "pt-BR", { sensitivity: "base" }) * (dir === "desc" ? -1 : 1));
  const start = (page - 1) * USER_PAGE_SIZE;
  return { rows: filtered.slice(start, start + USER_PAGE_SIZE), total: filtered.length };
}
