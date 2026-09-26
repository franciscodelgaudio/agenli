export { auth as proxy } from "@/auth";

export const config = {
  // Tudo exceto as rotas do Auth.js, os webhooks (autenticados por assinatura), assets do
  // Next e arquivos com extensão (public/).
  matcher: ["/((?!api/auth|api/webhooks|_next/static|_next/image|.*\\..*).*)"],
};
