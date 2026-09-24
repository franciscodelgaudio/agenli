import { redirect } from "next/navigation";
import { isObjectIdOrHexString, Types } from "mongoose";
import { auth } from "@/auth";

// Para páginas e layouts: sem sessão válida, manda para o login.
export async function requireUser() {
  const user = (await auth())?.user;
  if (!user?.id || !isObjectIdOrHexString(user.id)) redirect("/login");
  return { ...user, id: user.id };
}

// Para server actions: retorna null em vez de redirecionar, e a action
// decide a mensagem de erro.
export async function getSessionUserId() {
  const id = (await auth())?.user?.id;
  return id && isObjectIdOrHexString(id) ? id : null;
}

// $match que só encontra o workspace se ele for do usuário. Aggregation não
// converte string em ObjectId sozinho, então a conversão é feita aqui; id
// inválido vira null para a página responder 404 sem ir ao banco.
export function matchOwnedWorkspace(workspaceId: string, userId: string) {
  if (!isObjectIdOrHexString(workspaceId)) return null;
  return {
    $match: { _id: new Types.ObjectId(workspaceId), userId: new Types.ObjectId(userId) },
  };
}
