import { Field, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { RevenueShareFields } from "@/components/revenue-share-fields"
import { UnitTeamFields } from "@/components/unit-team-fields"
import type { RevenueShare } from "@/lib/revenue-share"
import type { TeamCandidate } from "@/lib/unit-team"

// Massagistas e recepcionistas do workspace para escolher quem trabalha na unidade.
export type UnitTeamOptions = { candidates: TeamCandidate[]; canLinkTherapists: boolean }

type Props = {
  idPrefix: string
  defaultValues?: { id: string; name: string; avatarUrl: string | null; revenueShare: RevenueShare | null }
  team: UnitTeamOptions
}

export function UnitFields({ idPrefix, defaultValues, team }: Props) {
  return (
    <>
      <Field>
        <FieldLabel htmlFor={`${idPrefix}-name`}>Nome</FieldLabel>
        <Input
          id={`${idPrefix}-name`}
          name="name"
          placeholder="Unidade Centro"
          defaultValue={defaultValues?.name}
          maxLength={80}
          autoFocus
          required
        />
      </Field>
      <Field>
        <FieldLabel htmlFor={`${idPrefix}-avatar-url`}>URL do avatar (opcional)</FieldLabel>
        <Input
          id={`${idPrefix}-avatar-url`}
          name="avatarUrl"
          type="url"
          placeholder="https://exemplo.com/logo.png"
          defaultValue={defaultValues?.avatarUrl ?? undefined}
        />
      </Field>
      <UnitTeamFields
        idPrefix={idPrefix}
        team={team.candidates}
        unitId={defaultValues?.id}
        canLinkTherapists={team.canLinkTherapists}
      />
      <RevenueShareFields idPrefix={idPrefix} defaultValue={defaultValues?.revenueShare} />
    </>
  )
}
