import type { ServiceAmounts, ServiceSummary } from "@/lib/cash-flow"
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

function money(cents: number) {
  return currencyFormat.format(cents / 100)
}

function AmountCells({ amounts }: { amounts: ServiceAmounts }) {
  return (
    <>
      <TableCell className="border-l px-4 text-right text-muted-foreground tabular-nums">{amounts.count}</TableCell>
      <TableCell className="px-4 text-right tabular-nums">{money(amounts.cents)}</TableCell>
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
            <TableHead className="px-4" />
            <TableHead colSpan={2} className="border-l px-4 text-center">
              Real
            </TableHead>
            <TableHead colSpan={2} className="border-l px-4 text-center">
              Previsto
            </TableHead>
          </TableRow>
          <TableRow>
            <TableHead className="px-4">Serviço</TableHead>
            <TableHead className="border-l px-4 text-right">Qtd.</TableHead>
            <TableHead className="px-4 text-right">Bruto</TableHead>
            <TableHead className="border-l px-4 text-right">Qtd.</TableHead>
            <TableHead className="px-4 text-right">Bruto</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {services.length === 0 ? (
            <TableRow>
              <TableCell colSpan={5} className="px-4 py-6 text-center text-muted-foreground">
                Nenhum serviço no período.
              </TableCell>
            </TableRow>
          ) : (
            services.map((service) => (
              <TableRow key={service.serviceId}>
                <TableCell className="px-4">{service.serviceName}</TableCell>
                <AmountCells amounts={service.real} />
                <AmountCells amounts={service.forecast} />
              </TableRow>
            ))
          )}
        </TableBody>
        {services.length > 0 && (
          <TableFooter>
            <TableRow>
              <TableCell className="px-4 font-semibold">Total</TableCell>
              <AmountCells amounts={sum("real")} />
              <AmountCells amounts={sum("forecast")} />
            </TableRow>
          </TableFooter>
        )}
      </Table>
    </div>
  )
}
