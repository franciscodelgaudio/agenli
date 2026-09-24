import { bookingListPipeline, parseBookingRange, type BookingRow } from "@/lib/booking-list"
import { getSessionUserId, workspaceAccessStages } from "@/lib/session"
import { Workspace } from "@/models/Workspace"

// Agendamentos do intervalo visível no calendário (?start=&end=&unit=&therapist=), de todas
// as unidades do workspace ou das filtradas. Qualquer membro do workspace pode ver.
// É GET (e não server action) porque o FullCalendar busca os eventos durante o render.
export async function GET(request: Request, { params }: RouteContext<"/api/workspace/[workspaceId]/bookings">) {
  const { workspaceId } = await params
  const userId = await getSessionUserId()
  if (!userId) return Response.json({ error: "Sua sessão expirou. Entre novamente." }, { status: 401 })
  const query = parseBookingRange(Object.fromEntries(new URL(request.url).searchParams))
  if (!query) return Response.json({ error: "Período inválido." }, { status: 400 })
  const access = workspaceAccessStages(workspaceId, userId)
  if (!access) return Response.json({ error: "Workspace não encontrado." }, { status: 404 })

  const [workspace] = await Workspace.aggregate<{ bookings: BookingRow[] }>([
    ...access,
    { $lookup: { from: "units", localField: "_id", foreignField: "workspaceId", as: "units" } },
    {
      $lookup: {
        from: "bookings",
        localField: "units._id",
        foreignField: "unitId",
        as: "bookings",
        pipeline: bookingListPipeline(query),
      },
    },
    { $project: { _id: 0, bookings: 1 } },
  ])
  if (!workspace) return Response.json({ error: "Workspace não encontrado." }, { status: 404 })
  return Response.json({ bookings: workspace.bookings })
}
