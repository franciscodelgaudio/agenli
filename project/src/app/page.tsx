import { redirect } from "next/navigation"
import { getHomePathForCurrentUser } from "@/lib/dal"

// "/" é o destino padrão após login e cadastro: manda para o workspace do
// usuário ou para a criação do primeiro.
export default async function Home() {
  redirect(await getHomePathForCurrentUser())
}
