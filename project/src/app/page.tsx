import { redirect } from "next/navigation"
import { Types } from "mongoose"
import { requireUser } from "@/lib/session"
import { Workspace } from "@/models/Workspace"

// "/" é o destino padrão após login e cadastro: manda para o workspace do
// usuário ou para a criação do primeiro.
export default async function Home() {
  const user = await requireUser()

  // O workspace mais antigo é o padrão.
  const [workspace] = await Workspace.aggregate<{ id: string }>([
    { $match: { userId: new Types.ObjectId(user.id) } },
    { $sort: { createdAt: 1 } },
    { $limit: 1 },
    { $project: { _id: 0, id: { $toString: "$_id" } } },
  ])

  redirect(workspace ? `/workspace/${workspace.id}` : "/workspace/new")
}
