"use client"

import { useState } from "react"
import type { CashFlowView } from "@/lib/cash-flow"
import { RankList, type RankItem } from "@/components/unit-overview"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

const views: CashFlowView[] = ["week", "month", "year"]
const viewLabels: Record<CashFlowView, string> = { week: "Semana", month: "Mês", year: "Ano" }

export type RankPeriod = { label: string; items: RankItem[]; empty: React.ReactNode }

// Ranking com troca entre a semana, o mês e o ano correntes; começa no mês.
export function PeriodRankCard({
  title,
  action,
  avatar,
  periods,
}: {
  title: string
  action?: React.ReactNode
  avatar?: "round" | "square"
  periods: Record<CashFlowView, RankPeriod>
}) {
  const [view, setView] = useState<CashFlowView>("month")
  const period = periods[view]
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription className="first-letter:uppercase">{period.label}, pelo previsto</CardDescription>
        {action}
      </CardHeader>
      <CardContent className="flex-1 gap-4">
        <div className="flex gap-1">
          {views.map((option) => (
            <Button
              key={option}
              variant={option === view ? "secondary" : "ghost"}
              size="xs"
              aria-pressed={option === view}
              onClick={() => setView(option)}
            >
              {viewLabels[option]}
            </Button>
          ))}
        </div>
        {period.items.length ? <RankList avatar={avatar} items={period.items} /> : period.empty}
      </CardContent>
    </Card>
  )
}
