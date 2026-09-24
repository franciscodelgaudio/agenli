import { CreateWorkspaceForm } from "@/components/create-workspace-form"

// Fica fora de [workspaceId], então não herda a sidebar.
export default function NewWorkspacePage() {
  return (
    <div className="flex min-h-svh items-center justify-center p-6 md:p-10">
      <div className="w-full max-w-sm">
        <CreateWorkspaceForm />
      </div>
    </div>
  )
}
