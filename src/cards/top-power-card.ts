import { html, css, LitElement } from "lit"
import L from "../intl"
import { ExtendedHomeAssistant } from "../types"
import { findEntities, formTexts, label, numberSelector, registerCard, sensorSelector } from "../editor"

interface TopPowerCardConfig {
  total?: CircuitEntry
  circuits?: CircuitEntry[]
  title?: string
  limit?: number
  idle_threshold?: number
  high_threshold?: number
}

interface CircuitEntry {
  entity: string
  name?: string
  idle_threshold?: number
  high_threshold?: number
}

class TopPowerCard extends LitElement {
  config!: TopPowerCardConfig
  hass!: ExtendedHomeAssistant

  static getConfigForm() {
    const text = (name: string) => label("power.editor", name)
    return {
      schema: [
        { name: "title", selector: { text: {} } },
        {
          type: "expandable",
          name: "total",
          schema: [
            { name: "entity", required: true, selector: sensorSelector("power") },
            { name: "name", selector: { text: {} } },
          ],
        },
        // Each circuit is edited in its own dialog. If this HA version can't
        // do that, the object selector falls back to a YAML box for the list.
        {
          name: "circuits",
          required: true,
          selector: {
            object: {
              multiple: true,
              label_field: "entity",
              fields: {
                entity: { label: text("entity"), required: true, selector: sensorSelector("power") },
                name: { label: text("name"), selector: { text: {} } },
                idle_threshold: { label: text("idle_threshold"), selector: numberSelector({ min: 0 }) },
                high_threshold: { label: text("high_threshold"), selector: numberSelector({ min: 0 }) },
              },
            },
          },
        },
        {
          type: "grid",
          name: "",
          schema: [
            { name: "limit", selector: numberSelector({ min: 0 }) },
            { name: "idle_threshold", selector: numberSelector({ min: 0 }) },
            { name: "high_threshold", selector: numberSelector({ min: 0 }) },
          ],
        },
      ],
      ...formTexts("power.editor"),
    }
  }

  static getStubConfig(hass: ExtendedHomeAssistant, unused?: string[]) {
    const [total, ...circuits] = findEntities(hass, unused, "sensor", ["power"], 4)
    return {
      total: { entity: total || "" },
      circuits: circuits.map(entity => ({ entity })),
    }
  }

  static get properties() {
    return {
      hass: {},
      config: {},
    }
  }

  constructor() {
    super()
  }

  setConfig(config: TopPowerCardConfig) {
    this.config = config
  }

  L(key: string): string {
    return L(this.hass, key)
  }

  render() {
    if (!this.hass || !this.config) return html``

    const title = this.config.title || this.L('power.title')

    // Tolerates a half-filled config (as while editing it in the UI).
    const entries = (this.config.circuits || []).filter(device => device?.entity).map(device => ({
      device,
      value: parseFloat(this.hass.states[device.entity]?.state)
    }))
    entries.sort((a, b) => a.value > b.value ? -1 : 1)
    const limit = this.config.limit
    if (limit && limit > 0) {
      entries.splice(limit, entries.length - limit)
    }

    return html`
      <ha-card>
        <header>
          <h1>
            ${title}
          </h1>
        </header>
        <main>
          ${this.config.total?.entity ? this.renderEntry(this.config.total, true) : null}
          ${entries.map(e => this.renderEntry(e.device))}
        </main>
      </ha-card>
    `
  }

  renderEntry(device: CircuitEntry, isTotal?: boolean) {
    const state = this.hass.states[device.entity]
    const name = device.name || this.hass.entities[device.entity]?.name || state?.attributes?.friendly_name || device.entity
    const value = parseFloat(state?.state)
    let status = 'normal'
    const idleThreshold = device.idle_threshold || this.config.idle_threshold || 5
    const highThreshold = device.high_threshold || this.config.high_threshold || 300
    if (value < idleThreshold) status = 'idle'
    if (value > highThreshold) status = 'high'
    if (isNaN(value)) status = 'idle'
    if (isTotal) status = 'total'

    return html`
      <div class="section-entry ${status}" @click="${() => this.entryClicked(device.entity)}">
        <div class="section-icon"><ha-icon icon="mdi:flash"></ha-icon></div>
        <div class="section-title">${name}</div>
        <div class="section-value">${!isNaN(value) ? Math.round(value) + ' W' : '--'}</div>
      </div>
    `
  }

  entryClicked(entityId: string) {
    const event = new CustomEvent('hass-more-info', {
      bubbles: true,
      composed: true,
      detail: { entityId },
    })
    this.dispatchEvent(event)
  }

  static get styles() {
    return css`
      ha-card {
        color: var(--primary-text-color,inherit);
      }
      header {
        padding: 22px 16px 0;
      }
      h1 {
        color: var(--ha-card-header-color,--primary-text-color);
        font-family: var(--ha-card-header-font-family,inherit);
        font-size: var(--ha-card-header-font-size,24px);
        letter-spacing: -0.012em;
        line-height: 24px;
        font-weight: 400;
        margin: 0;
      }
      main {
        padding: 16px;
      }
      .section-entry {
        display: flex;
        align-items: center;
        margin: 8px 0;
      }
      .section-icon {
        --mdc-icon-size: 24px;
        color: var(--paper-item-icon-color);
        cursor: pointer;
        height: 40px;
        width: 40px;
        line-height: 40px;
        text-align: center;
      }
      .section-entry.idle .section-icon {
        color: var(--state-unavailable-color);
      }
      .section-entry.high .section-icon {
        color: #e35757;
      }
      .section-title {
        cursor: pointer;
        flex: 1 1 auto;
        overflow: hidden;
        text-overflow: ellipsis;
        margin: 0 8px 0 16px;
      }
      .section-entry.idle .section-title {
        opacity: 0.7;
      }
      .section-value {
        flex: 0 0 auto;
      }
    `
  }

}

customElements.define("top-power-card", TopPowerCard)
registerCard("top-power-card", "Top Power Card", "Power consumption per circuit, sorted to show the biggest consumers at a glance.")
