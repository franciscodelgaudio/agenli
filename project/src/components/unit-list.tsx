import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"

type Props = {
  units: { id: string; name: string; avatarUrl: string | null }[]
}

export function UnitList({ units }: Props) {
  return (
    <ul className="divide-y rounded-xl border">
      {units.map((unit) => (
        <li key={unit.id} className="flex items-center gap-3 p-4">
          <Avatar className="size-10 rounded-lg after:rounded-lg">
            {unit.avatarUrl && (
              <AvatarImage src={unit.avatarUrl} alt={unit.name} className="rounded-lg" />
            )}
            <AvatarFallback className="rounded-lg">
              {unit.name.charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <span className="truncate font-medium">{unit.name}</span>
        </li>
      ))}
    </ul>
  )
}
