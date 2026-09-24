import type { CashFlowAmounts, CashFlowSummary, CashFlowView, DayRange } from "@/lib/cash-flow"
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

// As datas são dias do calendário, então são formatadas em UTC para não deslocar.
const weekdayFormat = new Intl.DateTimeFormat("pt-BR", { weekday: "short", day: "2-digit", month: "2-digit", timeZone: "UTC" })
const dayMonthFormat = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", timeZone: "UTC" })
const monthFormat = new Intl.DateTimeFormat("pt-BR", { month: "long", timeZone: "UTC" })

function toDate(day: string) {
  const [year, month, date] = day.split("-").map(Number)
  return new Date(Date.UTC(year, month - 1, date))
}

function bucketLabel(view: CashFlowView, { from, to }: DayRange) {
  if (view === "week") return weekdayFormat.format(toDate(from))
  if (view === "year") return monthFormat.format(toDate(from))
  return from === to
    ? dayMonthFormat.format(toDate(from))
    : `${dayMonthFormat.format(toDate(from))} a ${dayMonthFormat.format(toDate(to))}`
}

function money(cents: number) {
  return currencyFormat.format(cents / 100)
}

type Props = {
  view: CashFlowView
  summary: CashFlowSummary
  // Sem repasse (espaço próprio), bruto e líquido são iguais e as colunas de repasse somem.
  hasPartnerShare: boolean
  today: string
}

function AmountCells({ amounts, hasPartnerShare }: { amounts: CashFlowAmounts; hasPartnerShare: boolean }) {
  return (
    <>
      <TableCell className="px-4 text-right tabular-nums">{money(amounts.grossCents)}</TableCell>
      {hasPartnerShare && (
        <>
          <TableCell className="px-4 text-right text-muted-foreground tabular-nums">
            {amounts.partnerShareCents ? `−${money(amounts.partnerShareCents)}` : money(0)}
          </TableCell>
          <TableCell className="px-4 text-right font-medium tabular-nums">{money(amounts.netCents)}</TableCell>
        </>
      )}
    </>
  )
}

// Real: atendimentos registrados. Previsto: real mais os agendamentos futuros.
export function CashFlowTable({ view, summary, hasPartnerShare, today }: Props) {
  const groupSpan = hasPartnerShare ? 3 : 1
  const amountHeads = (group: string) =>
    hasPartnerShare ? (
      <>
        <TableHead className="px-4 text-right">Bruto</TableHead>
        <TableHead className="px-4 text-right">Repasse</TableHead>
        <TableHead className="px-4 text-right">Líquido</TableHead>
      </>
    ) : (
      <TableHead className="px-4 text-right">{group}</TableHead>
    )

  return (
    <div className="border">
      <Table>
        <TableHeader>
          {hasPartnerShare && (
            <TableRow>
              <TableHead className="px-4" />
              <TableHead colSpan={groupSpan} className="border-l px-4 text-center">
                Real
              </TableHead>
              <TableHead colSpan={groupSpan} className="border-l px-4 text-center">
                Previsto
              </TableHead>
            </TableRow>
          )}
          <TableRow>
            <TableHead className="px-4">Período</TableHead>
            {amountHeads("Real")}
            {amountHeads("Previsto")}
          </TableRow>
        </TableHeader>
        <TableBody>
          {summary.buckets.map((bucket) => {
            const isCurrent = bucket.from <= today && today <= bucket.to
            return (
              <TableRow key={bucket.from} className={cn(isCurrent && "bg-muted/50")}>
                <TableCell className="px-4 first-letter:uppercase">
                  {bucketLabel(view, bucket)}
                  {isCurrent && <span className="ml-2 text-xs text-muted-foreground">(atual)</span>}
                </TableCell>
                <AmountCells amounts={bucket.real} hasPartnerShare={hasPartnerShare} />
                <AmountCells amounts={bucket.forecast} hasPartnerShare={hasPartnerShare} />
              </TableRow>
            )
          })}
        </TableBody>
        <TableFooter>
          <TableRow>
            <TableCell className="px-4 font-semibold">Total</TableCell>
            <AmountCells amounts={summary.total.real} hasPartnerShare={hasPartnerShare} />
            <AmountCells amounts={summary.total.forecast} hasPartnerShare={hasPartnerShare} />
          </TableRow>
        </TableFooter>
      </Table>
    </div>
  )
}
