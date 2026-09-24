import { notFound } from "next/navigation"
import { getCurrentWorkspace } from "@/lib/dal"

export default async function WorkspacePage({ params }: PageProps<"/workspace/[workspaceId]">) {
  const { workspaceId } = await params
  const workspace = await getCurrentWorkspace(workspaceId)
  if (!workspace) notFound()

  return (
    <div className="flex flex-1 flex-col gap-4 p-4">
      <h2 className="text-2xl font-semibold tracking-tight">{workspace.name}</h2>
    </div>
  )
}
