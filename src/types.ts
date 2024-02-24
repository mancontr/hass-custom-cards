import { HomeAssistant } from "custom-card-helpers"

export interface EntityHistoryEntry {
  s: string
  lu: number
}

export interface ExtendedHomeAssistant extends HomeAssistant {
  entities: {
    [k: string]: {
      entity_id: string
      name?: string
    }
  }
}
