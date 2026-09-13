// Minimal stand-ins for the real Home Assistant frontend elements/APIs our
// cards rely on, so they can be rendered stand-alone in this dev gallery.
//
// Important: these render into their OWN shadow root (never touch their
// light-DOM children). Mutating light-DOM children from connectedCallback
// corrupts lit-html's marker tracking in whatever template placed the
// element, silently misplacing or dropping unrelated bindings elsewhere in
// that same template — a real bug we hit once while building this tool.
import * as mdiIcons from "@mdi/js"

type IconMap = Record<string, string>

function iconPath(icon: string): string | undefined {
  const name = icon.replace(/^mdi:/, "")
  const camel = "mdi" + name.split("-").map(s => s[0]?.toUpperCase() + s.slice(1)).join("")
  return (mdiIcons as unknown as IconMap)[camel]
}

class MockHaIcon extends HTMLElement {
  static get observedAttributes() { return ["icon"] }
  private root: ShadowRoot

  constructor() {
    super()
    this.root = this.attachShadow({ mode: "open" })
    this.style.display = "inline-flex"
    this.style.alignItems = "center"
    this.style.justifyContent = "center"
    this.style.width = "var(--mdc-icon-size, 24px)"
    this.style.height = "var(--mdc-icon-size, 24px)"
    this.style.flex = "0 0 auto"
  }

  connectedCallback() { this.render() }
  attributeChangedCallback() { this.render() }

  render() {
    const icon = this.getAttribute("icon") || ""
    const path = iconPath(icon)
    this.root.innerHTML = path
      ? `<svg viewBox="0 0 24 24" style="width:100%;height:100%;display:block"><path d="${path}" fill="currentColor"/></svg>`
      : `<svg viewBox="0 0 24 24" style="width:100%;height:100%;display:block"><rect x="2" y="2" width="20" height="20" fill="none" stroke="currentColor" stroke-dasharray="3 2"/></svg>`
    if (!path) console.warn(`[dev] Unknown icon "${icon}" — check the mdi: name`)
  }
}

class MockRelativeTime extends HTMLElement {
  private root: ShadowRoot
  private _datetime?: number | string | null

  constructor() {
    super()
    this.root = this.attachShadow({ mode: "open" })
  }

  set datetime(value: number | string | null | undefined) {
    this._datetime = value
    this.render()
  }
  get datetime() { return this._datetime }
  // Real ha-relative-time also takes .hass, unused by our stub.
  set hass(_value: unknown) {}

  connectedCallback() { this.render() }

  render() {
    this.root.textContent = this._datetime
      ? new Date(this._datetime).toLocaleString()
      : "—"
  }
}

class MockHaDialog extends HTMLElement {
  static get observedAttributes() { return ["open"] }
  private root: ShadowRoot
  private _heading?: string

  constructor() {
    super()
    this.root = this.attachShadow({ mode: "open" })
  }

  set heading(value: string | undefined) {
    this._heading = value
    this.render()
  }
  get heading() { return this._heading }

  connectedCallback() { this.render() }
  attributeChangedCallback() { this.render() }

  render() {
    const isOpen = this.hasAttribute("open")
    if (!isOpen) {
      this.root.innerHTML = ""
      return
    }
    // Uses a <slot> rather than moving the light-DOM content into the shadow
    // root: moving nodes would reparent whatever lit-html is tracking there,
    // risking the same marker-corruption bug documented above. A <slot>
    // projects them into place without touching the light DOM at all.
    this.root.innerHTML = `
      <style>
        .overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 1000; }
        .box { background: var(--card-background-color, #1c1c1c); color: var(--primary-text-color, #fff); border-radius: 8px; padding: 16px 20px 20px; min-width: 280px; max-width: 90vw; max-height: 80vh; overflow: auto; box-shadow: 0 8px 24px rgba(0,0,0,0.5); position: relative; }
        h2 { margin: 0 24px 12px 0; font-size: 18px; font-weight: 500; }
        .close { position: absolute; top: 12px; right: 12px; cursor: pointer; background: none; border: none; color: inherit; font-size: 18px; line-height: 1; opacity: 0.7; }
        .close:hover { opacity: 1; }
      </style>
      <div class="overlay">
        <div class="box">
          <button class="close" aria-label="Close">✕</button>
          ${this._heading ? `<h2>${this._heading}</h2>` : ""}
          <slot></slot>
        </div>
      </div>
    `
    const overlay = this.root.querySelector(".overlay")
    overlay?.addEventListener("click", e => { if (e.target === overlay) this.close() })
    this.root.querySelector(".close")?.addEventListener("click", () => this.close())
  }

  close() {
    this.removeAttribute("open")
    this.dispatchEvent(new CustomEvent("closed", { bubbles: true, composed: true }))
  }
}

class MockEntityToggle extends HTMLElement {
  private root: ShadowRoot
  private _stateObj?: { state?: string }

  constructor() {
    super()
    this.root = this.attachShadow({ mode: "open" })
  }

  set stateObj(value: { state?: string } | undefined) {
    this._stateObj = value
    this.render()
  }
  get stateObj() { return this._stateObj }
  set hass(_value: unknown) {}

  connectedCallback() { this.render() }

  render() {
    const checked = this._stateObj?.state === "on"
    this.root.innerHTML = `<input type="checkbox" ${checked ? "checked" : ""} disabled style="cursor:not-allowed" />`
  }
}

export function installMocks() {
  if (!customElements.get("ha-icon")) customElements.define("ha-icon", MockHaIcon)
  if (!customElements.get("ha-relative-time")) customElements.define("ha-relative-time", MockRelativeTime)
  if (!customElements.get("ha-dialog")) customElements.define("ha-dialog", MockHaDialog)
  if (!customElements.get("ha-entity-toggle")) customElements.define("ha-entity-toggle", MockEntityToggle)
}

export interface MockState {
  state: string
  attributes?: Record<string, unknown>
}

function prettify(entityId: string): string {
  return entityId.split(".").slice(1).join(".").replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase())
}

// Canned "history/history_during_period" response: a couple of on/off
// transitions per entity over the last day, enough for events-card and
// sprinklers-card's "last watered" lookup to have something to show.
function mockHistory(entityIds: string[]) {
  const now = Date.now()
  const result: Record<string, { s: string, lu: number }[]> = {}
  entityIds.forEach((id, i) => {
    const base = now / 1000 - (i + 1) * 3600 * 5
    result[id] = [
      { s: "on", lu: base },
      { s: "off", lu: base + 180 },
      { s: "on", lu: base + 3600 },
      { s: "off", lu: base + 3720 },
    ]
  })
  return result
}

export function buildHass(states: Record<string, MockState>, extra: Record<string, unknown> = {}) {
  const entities: Record<string, { entity_id: string, name: string }> = {}
  for (const id of Object.keys(states)) {
    entities[id] = { entity_id: id, name: prettify(id) }
  }
  return {
    language: "en",
    selectedLanguage: "en",
    dockedSidebar: "auto",
    entities,
    states,
    callWS: (msg: { type: string, entity_ids?: string[] }) => {
      if (msg.type === "history/history_during_period") {
        return Promise.resolve(mockHistory(msg.entity_ids || []))
      }
      return Promise.resolve({})
    },
    callService: (...args: unknown[]) => {
      // eslint-disable-next-line no-console
      console.log("[dev] callService", ...args)
    },
    ...extra,
  }
}
