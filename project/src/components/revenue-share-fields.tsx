"use client"

import { useState } from "react"
import { PlusIcon, Trash2Icon } from "lucide-react"
import { REVENUE_SHARE_MODES, REVENUE_SHARE_PERIODS, type RevenueShare, type RevenueShareMode } from "@/lib/revenue-share"

import { Button } from "@/components/ui/button"
import { Field, FieldDescription, FieldLabel, FieldSeparator } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { modeLabels, ownershipLabels, periodLabels, type Ownership } from "@/components/revenue-share-labels"
import { currencyFormat } from "@/components/service-format"

const MAX_TIERS = 10

type Tier = { key: number; limit: string; percent: string }

function toTiers(revenueShare: RevenueShare | null): Tier[] {
  if (!revenueShare) return [{ key: 0, limit: "", percent: "" }]
  return revenueShare.tiers.map((tier, key) => ({
    key,
    limit: tier.upToCents === null ? "" : (tier.upToCents / 100).toFixed(2),
    percent: String(tier.percent),
  }))
}

type Props = {
  idPrefix: string
  // null = espaço próprio (ou unidade ainda sem regra).
  defaultValue?: RevenueShare | null
}

// Onde a unidade funciona e, se for dentro de outro estabelecimento, quanto do
// faturamento fica com ele.
export function RevenueShareFields({ idPrefix, defaultValue = null }: Props) {
  const [ownership, setOwnership] = useState<Ownership>(defaultValue ? "partner" : "own")
  const [period, setPeriod] = useState(defaultValue?.period ?? "monthly")
  const [mode, setMode] = useState<RevenueShareMode>(defaultValue?.mode ?? "flat")
  const [tiers, setTiers] = useState(() => toTiers(defaultValue))

  function updateTier(key: number, patch: Partial<Tier>) {
    setTiers((current) => current.map((tier) => (tier.key === key ? { ...tier, ...patch } : tier)))
  }

  return (
    <>
      <Field>
        <FieldLabel htmlFor={`${idPrefix}-ownership`}>Onde a unidade funciona?</FieldLabel>
        <Select
          name="ownership"
          items={Object.entries(ownershipLabels).map(([value, label]) => ({ value, label }))}
          value={ownership}
          onValueChange={(value) => setOwnership(value as Ownership)}
          required
        >
          <SelectTrigger id={`${idPrefix}-ownership`} className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(ownershipLabels).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {ownership === "partner" && (
          <FieldDescription>O estabelecimento parceiro fica com parte do faturamento da unidade.</FieldDescription>
        )}
      </Field>

      {ownership === "partner" && (
        <>
          <FieldSeparator>Repasse ao estabelecimento</FieldSeparator>

          <Field>
            <FieldLabel htmlFor={`${idPrefix}-period`}>Período do faturamento</FieldLabel>
            <Select
              name="revenueSharePeriod"
              items={REVENUE_SHARE_PERIODS.map((value) => ({ value, label: periodLabels[value] }))}
              value={period}
              onValueChange={(value) => setPeriod(value as typeof period)}
              required
            >
              <SelectTrigger id={`${idPrefix}-period`} className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {REVENUE_SHARE_PERIODS.map((value) => (
                  <SelectItem key={value} value={value}>
                    {periodLabels[value]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          {/* Com uma faixa só os dois cálculos dão o mesmo resultado. */}
          {tiers.length > 1 ? (
            <Field>
              <FieldLabel htmlFor={`${idPrefix}-mode`}>Cálculo</FieldLabel>
              <Select
                name="revenueShareMode"
                items={REVENUE_SHARE_MODES.map((value) => ({ value, label: modeLabels[value] }))}
                value={mode}
                onValueChange={(value) => setMode(value as RevenueShareMode)}
                required
              >
                <SelectTrigger id={`${idPrefix}-mode`} className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {REVENUE_SHARE_MODES.map((value) => (
                    <SelectItem key={value} value={value}>
                      {modeLabels[value]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          ) : (
            <input type="hidden" name="revenueShareMode" value="flat" />
          )}

          {tiers.map((tier, index) => {
            const isLast = index === tiers.length - 1
            const previousLimit = Number(tiers[index - 1]?.limit)
            return (
              <div key={tier.key} className="grid gap-2 border p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium">
                    {tiers.length === 1
                      ? "Sobre todo o faturamento"
                      : isLast
                        ? previousLimit
                          ? `Acima de ${currencyFormat.format(previousLimit)}`
                          : "Acima do limite anterior"
                        : `Faixa ${index + 1}`}
                  </span>
                  {tiers.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Remover faixa ${index + 1}`}
                      onClick={() => setTiers((current) => current.filter((t) => t.key !== tier.key))}
                    >
                      <Trash2Icon />
                    </Button>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {/* A ordem dos campos no FormData forma as faixas; a última não tem limite. */}
                  {!isLast && (
                    <Input
                      name="tierLimit"
                      type="number"
                      inputMode="decimal"
                      min={0.01}
                      step={0.01}
                      placeholder="Até R$ 30000,00"
                      aria-label={`Limite da faixa ${index + 1} (R$)`}
                      value={tier.limit}
                      onChange={(event) => updateTier(tier.key, { limit: event.target.value })}
                      required
                    />
                  )}
                  <Input
                    name="tierPercent"
                    type="number"
                    inputMode="decimal"
                    min={0}
                    max={100}
                    step={0.01}
                    placeholder="% do estabelecimento"
                    aria-label={`Percentual da faixa ${index + 1}`}
                    className={isLast ? "col-span-2" : undefined}
                    value={tier.percent}
                    onChange={(event) => updateTier(tier.key, { percent: event.target.value })}
                    required
                  />
                </div>
              </div>
            )
          })}

          {tiers.length < MAX_TIERS && (
            <Button
              type="button"
              variant="outline"
              onClick={() =>
                setTiers((current) => [
                  ...current,
                  { key: Math.max(...current.map((t) => t.key)) + 1, limit: "", percent: "" },
                ])
              }
            >
              <PlusIcon />
              Adicionar faixa
            </Button>
          )}
        </>
      )}
    </>
  )
}
