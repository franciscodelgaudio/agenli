import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"

type Props = {
  hotels: { id: string; name: string; avatarUrl: string | null }[]
}

export function HotelList({ hotels }: Props) {
  return (
    <ul className="divide-y rounded-xl border">
      {hotels.map((hotel) => (
        <li key={hotel.id} className="flex items-center gap-3 p-4">
          <Avatar className="size-10 rounded-lg after:rounded-lg">
            {hotel.avatarUrl && (
              <AvatarImage src={hotel.avatarUrl} alt={hotel.name} className="rounded-lg" />
            )}
            <AvatarFallback className="rounded-lg">
              {hotel.name.charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <span className="truncate font-medium">{hotel.name}</span>
        </li>
      ))}
    </ul>
  )
}
