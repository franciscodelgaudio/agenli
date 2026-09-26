import { roleLabels } from "@/components/role-labels"
import { QuerySelect } from "@/components/user-filters"

const ALL = "all"

const roleItems = [
  { value: ALL, label: "Todas as funções" },
  { value: "massage_therapist", label: roleLabels.massage_therapist },
  { value: "receptionist", label: roleLabels.receptionist },
]

const statusItems = [
  { value: ALL, label: "Todos os status" },
  { value: "active", label: "Ativos" },
  { value: "pending", label: "Convite pendente" },
]

const payItems = [
  { value: ALL, label: "Toda remuneração" },
  { value: "commission", label: "Comissão" },
  { value: "salary", label: "Salário" },
  { value: "none", label: "Não definida" },
]

type Props = {
  // role/status/pay vazios = todos; os demais campos da query são preservados na URL.
  query: { role: string; status: string; pay: string } & Record<string, string>
}

export function UnitTeamFilters({ query }: Props) {
  return (
    <>
      <QuerySelect query={query} field="role" items={roleItems} label="Filtrar por função" />
      <QuerySelect query={query} field="status" items={statusItems} label="Filtrar por status" />
      <QuerySelect query={query} field="pay" items={payItems} label="Filtrar por remuneração" />
    </>
  )
}
