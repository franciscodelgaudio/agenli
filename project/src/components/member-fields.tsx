"use client"

import { MEMBER_ROLES, type MemberRole } from "@/lib/member-role"
import { roleLabels } from "@/components/role-labels"
import { Field, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"


const roleItems = MEMBER_ROLES.map((role) => ({ value: role, label: roleLabels[role] }))

export function RoleField({ idPrefix, defaultValue }: { idPrefix: string; defaultValue?: MemberRole }) {
  return (
    <Field>
      <FieldLabel htmlFor={`${idPrefix}-role`}>Função</FieldLabel>
      <Select name="role" items={roleItems} defaultValue={defaultValue ?? null} required>
        <SelectTrigger id={`${idPrefix}-role`} className="w-full">
          <SelectValue placeholder="Escolha uma função" />
        </SelectTrigger>
        <SelectContent>
          {roleItems.map((item) => (
            <SelectItem key={item.value} value={item.value}>
              {item.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </Field>
  )
}

export function MemberNameField({ idPrefix, defaultValue }: { idPrefix: string; defaultValue: string }) {
  return (
    <Field>
      <FieldLabel htmlFor={`${idPrefix}-name`}>Nome</FieldLabel>
      <Input
        id={`${idPrefix}-name`}
        name="name"
        defaultValue={defaultValue}
        maxLength={80}
        autoFocus
        required
      />
    </Field>
  )
}
