import type { TherapistAmounts, TherapistSummary } from "@/lib/cash-flow"
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

const percentFormat = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 2 })

function money(cents: number) {
  return currencyFormat.format(cents / 100)
}

function AmountCells({ amounts }: { amounts: TherapistAmounts }) {
  return (
    <>
      <TableCell className="border-l px-4 text-right text-muted-foreground tabular-nums">{amounts.count}</TableCell>
      <TableCell className="px-4 text-right tabular-nums">{money(amounts.cents)}</TableCell>
      <TableCell className="px-4 text-right font-medium tabular-nums">{money(amounts.commissionCents)}</TableCell>
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
            <TableHead colSpan={3} className="border-l px-4 text-center">
              Real
            </TableHead>
            <TableHead colSpan={3} className="border-l px-4 text-center">
              Previsto
            </TableHead>
          </TableRow>
          <TableRow>
            <TableHead className="px-4">Massagista</TableHead>
            <TableHead className="px-4 text-right">Comissão</TableHead>
            <TableHead className="border-l px-4 text-right">Qtd.</TableHead>
            <TableHead className="px-4 text-right">Bruto</TableHead>
            <TableHead className="px-4 text-right">Comissão</TableHead>
            <TableHead className="border-l px-4 text-right">Qtd.</TableHead>
            <TableHead className="px-4 text-right">Bruto</TableHead>
            <TableHead className="px-4 text-right">Comissão</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {therapists.length === 0 ? (
            <TableRow>
              <TableCell colSpan={8} className="px-4 py-6 text-center text-muted-foreground">
                Nenhum serviço no período.
              </TableCell>
            </TableRow>
          ) : (
            therapists.map((therapist) => (
              <TableRow key={therapist.therapistId}>
                <TableCell className="px-4">{therapist.therapistName}</TableCell>
                <TableCell className="px-4 text-right text-muted-foreground tabular-nums">
                  {therapist.commissionPercent === null ? "—" : `${percentFormat.format(therapist.commissionPercent)}%`}
                </TableCell>
                <AmountCells amounts={therapist.real} />
                <AmountCells amounts={therapist.forecast} />
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
              <AmountCells amounts={sum("real")} />
              <AmountCells amounts={sum("forecast")} />
            </TableRow>
          </TableFooter>
        )}
      </Table>
    </div>
  )
}
