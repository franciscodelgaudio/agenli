import { notFound } from "next/navigation"
import { canManageMembers, type WorkspaceRole } from "@/lib/member"
import { requireUser, workspaceAccessStages } from "@/lib/session"
import { therapistOptionsStages } from "@/lib/therapist"
import { Workspace } from "@/models/Workspace"
import { BookingCalendar, type BookingOptions } from "@/components/booking-calendar"

// Agenda de todas as unidades do workspace. Os agendamentos são buscados pelo próprio
// calendário, conforme o período visível; aqui vêm só as opções dos filtros e do formulário.
export default async function CalendarPage({ params }: PageProps<"/workspace/[workspaceId]/calendar">) {
  const { workspaceId } = await params
  const user = await requireUser()
  const access = workspaceAccessStages(workspaceId, user.id)
  if (!access) notFound()

  const [workspace] = await Workspace.aggregate<BookingOptions & { role: WorkspaceRole }>([
    ...access,
    {
      $lookup: {
        from: "hotels",
        localField: "_id",
        foreignField: "workspaceId",
        as: "hotels",
        pipeline: [{ $sort: { name: 1, _id: 1 } }, { $project: { name: 1 } }],
      },
    },
    {
      $lookup: {
        from: "services",
        localField: "hotels._id",
        foreignField: "hotelId",
        as: "services",
        pipeline: [
          { $sort: { name: 1, _id: 1 } },
          {
            $project: {
              _id: 0,
              id: { $toString: "$_id" },
              hotelId: { $toString: "$hotelId" },
              name: 1,
              durationMinutes: 1,
            },
          },
        ],
      },
    },
    ...therapistOptionsStages(),
    {
      $project: {
        _id: 0,
        role: 1,
        units: { $map: { input: "$hotels", as: "hotel", in: { id: { $toString: "$$hotel._id" }, name: "$$hotel.name" } } },
        services: 1,
        therapists: 1,
      },
    },
  ])
  if (!workspace) notFound()
  const { role, ...options } = workspace

  return (
    <div className="flex flex-1 flex-col gap-4 p-4">
      <h2 className="text-2xl font-semibold tracking-tight">Calendário</h2>
      <BookingCalendar workspaceId={workspaceId} canManage={canManageMembers(role)} {...options} />
    </div>
  )
}
