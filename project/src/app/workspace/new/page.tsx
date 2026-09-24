import { CreateWorkspaceForm } from "@/components/create-workspace-form"
import { requireUser } from "@/lib/session"

// Fica fora de [workspaceId], então não herda a sidebar.
export default async function NewWorkspacePage() {
  await requireUser()

  return (
    <div className="flex min-h-svh items-center justify-center p-6 md:p-10">
      <div className="w-full max-w-sm">
        <CreateWorkspaceForm />
      </div>
    </div>
  )
}
