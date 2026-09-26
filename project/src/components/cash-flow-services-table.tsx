import type { ServiceAmounts, ServiceSummary } from "@/lib/cash-flow"
import { CodeCell, CodeHead } from "@/components/record-code"
import { currencyFormat } from "@/components/service-format"
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { cn } from "@/lib/utils"

function money(cents: number) {
  return currencyFormat.format(cents / 100)
}

// Com a tabela estreita, o grupo Previsto some inteiro.
const FORECAST = "@max-2xl:hidden"

function AmountCells({ amounts, className }: { amounts: ServiceAmounts; className?: string }) {
  return (
    <>
      <TableCell className={cn("border-l px-4 text-right text-muted-foreground tabular-nums", className)}>
        {amounts.count}
      </TableCell>
      <TableCell className={cn("px-4 text-right tabular-nums", className)}>{money(amounts.cents)}</TableCell>
    </>
  )
}

// Valores brutos: o repasse é calculado sobre o faturamento total, não por serviço.
export function CashFlowServicesTable({ services }: { services: ServiceSummary[] }) {
  const sum = (key: "real" | "forecast") =>
    services.reduce(
      (total, service) => ({ count: total.count + service[key].count, cents: total.cents + service[key].cents }),
      { count: 0, cents: 0 },
    )

  return (
    <div className="border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="px-4" colSpan={2} />
            <TableHead colSpan={2} className="border-l px-4 text-center">
              Real
            </TableHead>
            <TableHead colSpan={2} className={cn("border-l px-4 text-center", FORECAST)}>
              Previsto
            </TableHead>
          </TableRow>
          <TableRow>
            <CodeHead />
            <TableHead className="w-full px-4">Serviço</TableHead>
            <TableHead className="border-l px-4 text-right">Qtd.</TableHead>
            <TableHead className="px-4 text-right">Bruto</TableHead>
            <TableHead className={cn("border-l px-4 text-right", FORECAST)}>Qtd.</TableHead>
            <TableHead className={cn("px-4 text-right", FORECAST)}>Bruto</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {services.length === 0 ? (
            <TableRow>
              <TableCell colSpan={6} className="px-4 py-6 text-center text-muted-foreground">
                Nenhum serviço no período.
              </TableCell>
            </TableRow>
          ) : (
            services.map((service) => (
              <TableRow key={service.serviceId}>
                <CodeCell id={service.serviceId} />
                <TableCell className="max-w-0 truncate px-4">{service.serviceName}</TableCell>
                <AmountCells amounts={service.real} />
                <AmountCells amounts={service.forecast} className={FORECAST} />
              </TableRow>
            ))
          )}
        </TableBody>
        {services.length > 0 && (
          <TableFooter>
            <TableRow>
              <TableCell className="px-4 font-semibold" colSpan={2}>Total</TableCell>
              <AmountCells amounts={sum("real")} />
              <AmountCells amounts={sum("forecast")} className={FORECAST} />
            </TableRow>
          </TableFooter>
        )}
      </Table>
    </div>
  )
}
