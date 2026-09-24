"use server"

import { refresh } from "next/cache"
import { isObjectIdOrHexString } from "mongoose"
import { getSessionUserId } from "@/lib/session"
import { canManageMembers } from "@/lib/member"
import { findWorkspaceAccess } from "@/lib/workspace-access"
import {
  createService,
  deleteService,
  updateService,
  type CreateServiceError,
  type UpdateServiceError,
} from "@/lib/service"
import { Hotel } from "@/models/Hotel"
import { Service } from "@/models/Service"

const errorMessages: Record<CreateServiceError | UpdateServiceError | "unauthenticated", string> = {
  invalid_input: "Preencha nome, valor e duração.",
  invalid_name: "Informe o nome do serviço.",
  name_too_long: "O nome pode ter no máximo 80 caracteres.",
  invalid_price: "Informe um valor entre R$ 0,00 e R$ 1.000.000,00, com até 2 casas decimais.",
  invalid_duration: "Informe a duração em minutos, entre 1 e 1440.",
  hotel_not_found: "Unidade não encontrada ou sem permissão.",
  service_not_found: "Serviço não encontrado ou sem permissão.",
  unauthenticated: "Sua sessão expirou. Entre novamente.",
}

export type ServiceActionState = { error: string | null }

// id da unidade se ela for de um workspace que o usuário gerencia (dono ou
// administrador); senão undefined. null = sessão expirada.
async function findManagedHotelId(workspaceId: string, hotelId: string) {
  const userId = await getSessionUserId()
  if (!userId) return null
  const access = await findWorkspaceAccess(workspaceId, userId)
  if (!access || !canManageMembers(access.role) || !isObjectIdOrHexString(hotelId)) return undefined
  const hotel = await Hotel.exists({ _id: hotelId, workspaceId: access.id })
  return hotel ? hotelId : undefined
}

function serviceInput(formData: FormData) {
  return {
    name: formData.get("name"),
    price: formData.get("price"),
    durationMinutes: formData.get("durationMinutes"),
  }
}

// workspaceId e hotelId vêm via argumento do cliente; a posse é conferida aqui, no servidor.
export async function createServiceAction(
  workspaceId: string,
  hotelId: string,
  _prev: ServiceActionState,
  formData: FormData,
): Promise<ServiceActionState> {
  const ownedHotelId = await findManagedHotelId(workspaceId, hotelId)
  if (ownedHotelId === null) return { error: errorMessages.unauthenticated }

  const result = await createService(serviceInput(formData), ownedHotelId, async (data) => {
    const service = await Service.create(data)
    return { id: service._id.toString() }
  })

  if (!result.ok) return { error: errorMessages[result.error] }

  refresh()
  return { error: null }
}

// Só repassa o serviceId quando a unidade é gerenciável; a escrita ainda filtra
// por hotelId para que um serviço de outra unidade não seja encontrado.
// null = sessão expirada.
async function resolveServiceTarget(workspaceId: string, hotelId: string, serviceId: string) {
  const ownedHotelId = await findManagedHotelId(workspaceId, hotelId)
  if (ownedHotelId === null) return null
  return { ownedHotelId, serviceId: ownedHotelId && isObjectIdOrHexString(serviceId) ? serviceId : null }
}

export async function updateServiceAction(
  workspaceId: string,
  hotelId: string,
  serviceId: string,
  _prev: ServiceActionState,
  formData: FormData,
): Promise<ServiceActionState> {
  const target = await resolveServiceTarget(workspaceId, hotelId, serviceId)
  if (!target) return { error: errorMessages.unauthenticated }

  const result = await updateService(serviceInput(formData), target.serviceId, async (id, data) => {
    const { matchedCount } = await Service.updateOne({ _id: id, hotelId: target.ownedHotelId }, { $set: data })
    return matchedCount > 0
  })

  if (!result.ok) return { error: errorMessages[result.error] }

  refresh()
  return { error: null }
}

export async function deleteServiceAction(
  workspaceId: string,
  hotelId: string,
  serviceId: string,
): Promise<ServiceActionState> {
  const target = await resolveServiceTarget(workspaceId, hotelId, serviceId)
  if (!target) return { error: errorMessages.unauthenticated }

  const result = await deleteService(target.serviceId, async (id) => {
    const { deletedCount } = await Service.deleteOne({ _id: id, hotelId: target.ownedHotelId })
    return deletedCount > 0
  })

  if (!result.ok) return { error: errorMessages[result.error] }

  refresh()
  return { error: null }
}
