export { auth as proxy } from "@/auth";

export const config = {
  // Tudo exceto as rotas do Auth.js, assets do Next e arquivos com extensão (public/).
  matcher: ["/((?!api/auth|_next/static|_next/image|.*\\..*).*)"],
};
