"use client"

import { useState } from "react"
import type { TeamCandidate } from "@/lib/unit-team"
import { roleLabels } from "@/components/role-labels"
import { TherapistAvatar } from "@/components/therapist-avatar"
import {
  Combobox,
  ComboboxChip,
  ComboboxChips,
  ComboboxChipsInput,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxItem,
  ComboboxList,
  ComboboxValue,
  useComboboxAnchor,
} from "@/components/ui/combobox"
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field"

type Props = {
  idPrefix: string
  team: TeamCandidate[]
  // Unidade em edição; ausente ao cadastrar.
  unitId?: string
  // Só o proprietário vincula massagistas; para o admin elas ficam fixas.
  canLinkTherapists: boolean
}

// Escolha com busca de quem trabalha na unidade. Envia um teamMemberId por pessoa
// escolhida que o usuário pode alterar; as fixas o servidor mantém como estão.
export function UnitTeamFields({ idPrefix, team, unitId, canLinkTherapists }: Props) {
  const anchor = useComboboxAnchor()
  const isEditable = (member: TeamCandidate) => canLinkTherapists || member.role !== "massage_therapist"
  const [selected, setSelected] = useState(() => team.filter((member) => !!unitId && member.unitIds.includes(unitId)))
  const fixed = selected.filter((member) => !isEditable(member))

  return (
    <Field>
      <FieldLabel htmlFor={`${idPrefix}-team`}>Equipe</FieldLabel>
      <Combobox
        multiple
        items={team.filter(isEditable)}
        value={selected}
        // Quem não pode ser alterado continua escolhido.
        onValueChange={(next: TeamCandidate[]) => setSelected([...fixed, ...next.filter(isEditable)])}
        itemToStringLabel={(member: TeamCandidate) => member.name}
        isItemEqualToValue={(a: TeamCandidate, b: TeamCandidate) => a.id === b.id}
      >
        <ComboboxChips ref={anchor} className="w-full">
          <ComboboxValue>
            {(members: TeamCandidate[]) =>
              members.map((member) => (
                <ComboboxChip key={member.id} showRemove={isEditable(member)}>
                  <TherapistAvatar therapist={member} className="size-4" />
                  {member.name}
                </ComboboxChip>
              ))
            }
          </ComboboxValue>
          <ComboboxChipsInput
            id={`${idPrefix}-team`}
            placeholder={selected.length ? "" : "Buscar massagista ou recepcionista..."}
          />
        </ComboboxChips>
        <ComboboxContent anchor={anchor}>
          <ComboboxEmpty>
            {team.length ? "Ninguém encontrado." : "Nenhuma massagista ou recepcionista convidada. Convide em Usuários."}
          </ComboboxEmpty>
          <ComboboxList>
            {(member: TeamCandidate) => (
              <ComboboxItem key={member.id} value={member}>
                <span className="flex min-w-0 flex-1 items-center gap-2">
                  <TherapistAvatar therapist={member} className="size-6" />
                  <span className="truncate">{member.name}</span>
                  <span className="ml-auto shrink-0 text-xs text-muted-foreground">
                    {roleLabels[member.role]}
                    {member.pending && " · convite pendente"}
                  </span>
                </span>
              </ComboboxItem>
            )}
          </ComboboxList>
        </ComboboxContent>
      </Combobox>
      {selected.filter(isEditable).map((member) => (
        <input key={member.id} type="hidden" name="teamMemberId" value={member.id} />
      ))}
      <FieldDescription>
        A comissão ou o salário de cada pessoa é definido na Equipe da unidade.
        {!canLinkTherapists && " Só o proprietário vincula massagistas."}
      </FieldDescription>
    </Field>
  )
}
