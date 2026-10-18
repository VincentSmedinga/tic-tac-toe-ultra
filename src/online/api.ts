import { z } from 'zod'
import { roomCodeSchema } from '../../shared/protocol.ts'
import type { FieldSettings } from '../../shared/room.ts'

/** The HTTP side of the rooms: making one and asking whether one exists. */
export interface RoomApi {
  /** Makes a room; without a field it is classic tic-tac-toe. */
  createRoom: (field?: FieldSettings) => Promise<string>
  roomExists: (code: string) => Promise<boolean>
}

const createdSchema = z.object({ code: roomCodeSchema })
const existsSchema = z.object({ exists: z.boolean() })

export const roomApi: RoomApi = {
  async createRoom(field) {
    const response = await fetch(
      '/api/rooms',
      field === undefined
        ? { method: 'POST' }
        : {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(field),
          },
    )
    if (!response.ok) throw new Error(`Making a room failed with ${response.status.toString()}`)
    return createdSchema.parse(await response.json()).code
  },

  async roomExists(code) {
    const response = await fetch(`/api/rooms/${code}`)
    if (!response.ok) throw new Error(`Asking for a room failed with ${response.status.toString()}`)
    return existsSchema.parse(await response.json()).exists
  },
}
