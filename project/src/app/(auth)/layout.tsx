import { GalleryVerticalEndIcon } from "lucide-react"

// Moldura de duas colunas do bloco login-02, compartilhada por /login e /signup.
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-svh lg:grid-cols-2">
      <div className="flex flex-col gap-4 p-6 md:p-10">
        <div className="flex justify-center gap-2 md:justify-start">
          <a href="#" className="flex items-center gap-2 font-medium">
            <div className="flex size-6 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <GalleryVerticalEndIcon className="size-4" />
            </div>
            Acme Inc.
          </a>
        </div>
        <div className="flex flex-1 items-center justify-center">
          <div className="w-full max-w-xs">{children}</div>
        </div>
      </div>
      {/* Painel da imagem de capa: coloque a imagem em public/ e use um <Image> aqui. */}
      <div className="relative hidden bg-muted lg:block" />
    </div>
  )
}
