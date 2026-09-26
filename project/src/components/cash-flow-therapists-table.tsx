import type { TherapistAmounts, TherapistSummary } from "@/lib/cash-flow"
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

const percentFormat = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 2 })

function money(cents: number) {
  return currencyFormat.format(cents / 100)
}

// Com a tabela estreita, o grupo Previsto some inteiro e, depois, o percentual de comissão.
const FORECAST = "@max-5xl:hidden"
const PERCENT = "@max-xl:hidden"

function AmountCells({ amounts, className }: { amounts: TherapistAmounts; className?: string }) {
  return (
    <>
      <TableCell className={cn("border-l px-4 text-right text-muted-foreground tabular-nums", className)}>
        {amounts.count}
      </TableCell>
      <TableCell className={cn("px-4 text-right tabular-nums", className)}>{money(amounts.cents)}</TableCell>
      <TableCell className={cn("px-4 text-right font-medium tabular-nums", className)}>
        {money(amounts.commissionCents)}
      </TableCell>
    </>
  )
}

// Quem não tem comissão definida na unidade (inclusive o proprietário) aparece com comissão zero.
export function CashFlowTherapistsTable({ therapists }: { therapists: TherapistSummary[] }) {
  const sum = (key: "real" | "forecast") =>
    therapists.reduce(
      (total, therapist) => ({
        count: total.count + therapist[key].count,
        cents: total.cents + therapist[key].cents,
        commissionCents: total.commissionCents + therapist[key].commissionCents,
      }),
      { count: 0, cents: 0, commissionCents: 0 },
    )

  return (
    <div className="border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="px-4" colSpan={2} />
            <TableHead className={cn("px-4", PERCENT)} />
            <TableHead colSpan={3} className="border-l px-4 text-center">
              Real
            </TableHead>
            <TableHead colSpan={3} className={cn("border-l px-4 text-center", FORECAST)}>
              Previsto
            </TableHead>
          </TableRow>
          <TableRow>
            <CodeHead />
            <TableHead className="w-full px-4">Massagista</TableHead>
            <TableHead className={cn("px-4 text-right", PERCENT)}>Comissão</TableHead>
            <TableHead className="border-l px-4 text-right">Qtd.</TableHead>
            <TableHead className="px-4 text-right">Bruto</TableHead>
            <TableHead className="px-4 text-right">Comissão</TableHead>
            <TableHead className={cn("border-l px-4 text-right", FORECAST)}>Qtd.</TableHead>
            <TableHead className={cn("px-4 text-right", FORECAST)}>Bruto</TableHead>
            <TableHead className={cn("px-4 text-right", FORECAST)}>Comissão</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {therapists.length === 0 ? (
            <TableRow>
              <TableCell colSpan={9} className="px-4 py-6 text-center text-muted-foreground">
                Nenhum serviço no período.
              </TableCell>
            </TableRow>
          ) : (
            therapists.map((therapist) => (
              <TableRow key={therapist.therapistId}>
                <CodeCell id={therapist.therapistId} />
                <TableCell className="max-w-0 truncate px-4">{therapist.therapistName}</TableCell>
                <TableCell className={cn("px-4 text-right text-muted-foreground tabular-nums", PERCENT)}>
                  {therapist.commissionPercent === null ? "—" : `${percentFormat.format(therapist.commissionPercent)}%`}
                </TableCell>
                <AmountCells amounts={therapist.real} />
                <AmountCells amounts={therapist.forecast} className={FORECAST} />
              </TableRow>
            ))
          )}
        </TableBody>
        {therapists.length > 0 && (
          <TableFooter>
            <TableRow>
              <TableCell className="px-4 font-semibold" colSpan={2}>
                Total
              </TableCell>
              <TableCell className={PERCENT} />
              <AmountCells amounts={sum("real")} />
              <AmountCells amounts={sum("forecast")} className={FORECAST} />
            </TableRow>
          </TableFooter>
        )}
      </Table>
    </div>
  )
}
