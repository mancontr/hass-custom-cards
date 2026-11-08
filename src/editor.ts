// Helpers for the cards' visual editors, built with HA's getConfigForm():
// the card returns a schema and HA renders the form with its own components.
import { HassEntity } from "home-assistant-js-websocket"
import { languages } from "./intl"
import { ExtendedHomeAssistant } from "./types"

export type FormSchema = Record<string, unknown>

// getConfigForm() gets no hass object, so the language comes from the page
// itself: HA keeps <html lang> in sync with the user's language.
function editorText(key: string): string | undefined {
  const pageLang = document.documentElement.lang || "en"
  const lang = languages[pageLang] || languages[pageLang.split("-")[0]] || languages.en
  return lang[key] ?? languages.en[key]
}

// Labels come from "<prefix>.<field name>", and optional helper texts below
// each field from "<prefix>.<field name>.helper".
export function formTexts(prefix: string) {
  return {
    computeLabel: (schema: { name?: string }) =>
      schema.name ? editorText(`${prefix}.${schema.name}`) ?? schema.name : undefined,
    computeHelper: (schema: { name?: string }) =>
      schema.name ? editorText(`${prefix}.${schema.name}.helper`) : undefined,
  }
}

// For labels set directly in a schema (e.g. an object selector's fields).
export function label(prefix: string, name: string): string {
  return editorText(`${prefix}.${name}`) ?? name
}

// Up to `count` entities for a card's stub config (what the card picker
// shows): the ones not used in the dashboard yet go first, as HA suggests.
export function findEntities(
  hass: ExtendedHomeAssistant,
  unused: string[] | undefined,
  domain: string,
  deviceClasses: string[] = [],
  count = 1,
): string[] {
  const candidates = [...new Set([...(unused || []), ...Object.keys(hass.states)])]
  return candidates.filter(id => {
    if (!id.startsWith(`${domain}.`)) return false
    if (!deviceClasses.length) return true
    const state: HassEntity | undefined = hass.states[id]
    return deviceClasses.includes(state?.attributes?.device_class as string)
  }).slice(0, count)
}

export function sensorSelector(...deviceClasses: string[]) {
  return {
    entity: {
      filter: deviceClasses.length
        ? deviceClasses.map(device_class => ({ domain: "sensor", device_class }))
        : { domain: "sensor" },
    },
  }
}

export function numberSelector(options: { min?: number, max?: number, step?: number } = {}) {
  return { number: { mode: "box", ...options } }
}

interface CustomCardEntry {
  type: string
  name: string
  description: string
  preview?: boolean
  documentationURL?: string
}

declare global {
  interface Window {
    customCards?: CustomCardEntry[]
  }
}

// Lists the card in HA's card picker. With `preview`, the picker renders it
// live using getStubConfig(), so only set it when that shows something.
export function registerCard(type: string, name: string, description: string, preview = true) {
  window.customCards = window.customCards || []
  window.customCards.push({
    type,
    name,
    description,
    preview,
    documentationURL: `https://github.com/mancontr/hass-custom-cards/blob/main/docs/${type}.md`,
  })
}
