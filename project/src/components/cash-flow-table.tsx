import type { CashFlowView, DayRange, StaffCashFlowAmounts, StaffCashFlowSummary } from "@/lib/cash-flow"
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
  summary: StaffCashFlowSummary
  // Sem repasse (espaço próprio), comissão nem salário, bruto e líquido são iguais e só o bruto aparece.
  hasPartnerShare: boolean
  hasCommission: boolean
  hasSalary: boolean
  today: string
}

type Columns = { partnerShare: boolean; commission: boolean; salary: boolean }

function Deduction({ cents }: { cents: number }) {
  return (
    <TableCell className="px-4 text-right text-muted-foreground tabular-nums">
      {cents ? `−${money(cents)}` : money(0)}
    </TableCell>
  )
}

function AmountCells({ amounts, columns }: { amounts: StaffCashFlowAmounts; columns: Columns }) {
  const detailed = columns.partnerShare || columns.commission || columns.salary
  return (
    <>
      <TableCell className="px-4 text-right tabular-nums">{money(amounts.grossCents)}</TableCell>
      {columns.partnerShare && <Deduction cents={amounts.partnerShareCents} />}
      {columns.commission && <Deduction cents={amounts.commissionCents} />}
      {columns.salary && <Deduction cents={amounts.salaryCents} />}
      {detailed && <TableCell className="px-4 text-right font-medium tabular-nums">{money(amounts.netCents)}</TableCell>}
    </>
  )
}

// Real: atendimentos registrados. Previsto: real mais os agendamentos futuros.
export function CashFlowTable({ view, summary, hasPartnerShare, hasCommission, hasSalary, today }: Props) {
  const columns = { partnerShare: hasPartnerShare, commission: hasCommission, salary: hasSalary }
  const detailed = hasPartnerShare || hasCommission || hasSalary
  const groupSpan = 2 + Number(hasPartnerShare) + Number(hasCommission) + Number(hasSalary)
  const amountHeads = (group: string) =>
    detailed ? (
      <>
        <TableHead className="px-4 text-right">Bruto</TableHead>
        {hasPartnerShare && <TableHead className="px-4 text-right">Repasse</TableHead>}
        {hasCommission && <TableHead className="px-4 text-right">Comissão</TableHead>}
        {hasSalary && <TableHead className="px-4 text-right">Salário</TableHead>}
        <TableHead className="px-4 text-right">Líquido</TableHead>
      </>
    ) : (
      <TableHead className="px-4 text-right">{group}</TableHead>
    )

  return (
    <div className="border">
      <Table>
        <TableHeader>
          {detailed && (
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
                <AmountCells amounts={bucket.real} columns={columns} />
                <AmountCells amounts={bucket.forecast} columns={columns} />
              </TableRow>
            )
          })}
        </TableBody>
        <TableFooter>
          <TableRow>
            <TableCell className="px-4 font-semibold">Total</TableCell>
            <AmountCells amounts={summary.total.real} columns={columns} />
            <AmountCells amounts={summary.total.forecast} columns={columns} />
          </TableRow>
        </TableFooter>
      </Table>
    </div>
  )
}
