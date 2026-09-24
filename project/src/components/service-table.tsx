import { ClockIcon, BanknoteIcon, SettingsIcon, SparklesIcon } from "lucide-react"
import { ServiceActions } from "@/components/service-actions"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

type Props = {
  services: { id: string; name: string; priceCents: number; durationMinutes: number }[]
  workspaceId: string
  unitId: string
  // Sem permissão, a coluna de ações (editar/excluir) não aparece.
  canManage: boolean
}

const currencyFormat = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" })

// 90 -> "1h 30min"; 45 -> "45min"; 120 -> "2h".
function formatDuration(minutes: number) {
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  if (!hours) return `${rest}min`
  return rest ? `${hours}h ${rest}min` : `${hours}h`
}

export function ServiceTable({ services, workspaceId, unitId, canManage }: Props) {
  return (
    <div className="border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="px-4">
              <span className="inline-flex items-center gap-1">
                <SparklesIcon className="size-4 text-muted-foreground" />
                Serviço
              </span>
            </TableHead>
            <TableHead className="px-4">
              <span className="inline-flex items-center gap-1">
                <BanknoteIcon className="size-4 text-muted-foreground" />
                Valor
              </span>
            </TableHead>
            <TableHead className="px-4">
              <span className="inline-flex items-center gap-1">
                <ClockIcon className="size-4 text-muted-foreground" />
                Duração média
              </span>
            </TableHead>
            {canManage && (
              <TableHead className="w-0 px-4 text-right">
                <span className="inline-flex items-center gap-1">
                  <SettingsIcon className="size-4 text-muted-foreground" />
                  Ações
                </span>
              </TableHead>
            )}
          </TableRow>
        </TableHeader>
        <TableBody>
          {services.map((service) => (
            <TableRow key={service.id}>
              <TableCell className="px-4 font-medium">{service.name}</TableCell>
              <TableCell className="px-4 tabular-nums">{currencyFormat.format(service.priceCents / 100)}</TableCell>
              <TableCell className="px-4 text-muted-foreground">{formatDuration(service.durationMinutes)}</TableCell>
              {canManage && (
                <TableCell className="px-4 text-right">
                  <ServiceActions workspaceId={workspaceId} unitId={unitId} service={service} />
                </TableCell>
              )}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
