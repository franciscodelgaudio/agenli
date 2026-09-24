import type { RevenueShareMode, RevenueSharePeriod } from "@/lib/revenue-share"

// Nomes na interface; no código e no banco ficam em inglês.
export const ownershipLabels = {
  own: "Espaço próprio",
  partner: "Dentro de outro estabelecimento",
} as const

export type Ownership = keyof typeof ownershipLabels

export const periodLabels: Record<RevenueSharePeriod, string> = {
  weekly: "Semanal",
  biweekly: "Quinzenal",
  monthly: "Mensal",
}

export const modeLabels: Record<RevenueShareMode, string> = {
  flat: "Percentual da faixa atingida sobre o total",
  progressive: "Progressivo (cada parte na sua faixa)",
}
