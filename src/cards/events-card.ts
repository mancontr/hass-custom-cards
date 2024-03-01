import { html, css, LitElement } from "lit"
import L from "../intl"
import { EntityHistoryEntry, ExtendedHomeAssistant } from "../types"

interface EventsCardConfig {
  title?: string
  entities: EntityDetailsOrId[]
}

interface EntityDetails {
  entity: string
  name?: string
  icon?: string
}

type EntityDetailsOrId = EntityDetails | string

interface EventInfo {
  s: 'on' | 'off' | 'unknown'
  lu: number
  e: string
}

class EventsCard extends LitElement {
  config: EventsCardConfig
  hass: ExtendedHomeAssistant
  events: EventInfo[]

  static getConfigElement() {
    return document.createElement("events-card-editor")
  }

  static getStubConfig() {
    return {
      // ...
    }
  }

  static get properties() {
    return {
      hass: {},
      config: {},
      events: {},
    }
  }

  constructor() {
    super()
  }

  setConfig(config: EventsCardConfig) {
    this.config = config
  }

  L(key: string): string {
    return L(this.hass, key)
  }

  firstUpdated() {
    const ids = this.config?.entities.map(e => typeof e === 'string' ? e : e.entity)
    const start = new Date()
    start.setDate(start.getDate() - 1) // 1 day of activity
    return this.hass.callWS({
      type: 'history/history_during_period',
      entity_ids: ids,
      start_time: start.toISOString(),
      end_time: new Date().toISOString(),
      minimal_response: true,
      no_attributes: true,
      significant_changes_only: true,
    })
    .then(res => {
      const events: EventInfo[] = []
      ids.forEach(id => {
        res[id] && events.push(...res[id]
          .filter(evt => evt.s === 'on')
          .map(evt => ({ ...evt, e: id }))
        )
      })
      events.sort((a, b) => b.lu - a.lu)
      this.events = events
    })
  }

  render() {
    if (!this.hass || !this.config) return html``

    const title = this.config.title || this.L('events.title')

    return html`
      <ha-card>
        <header>
          <h1>
            ${title}
          </h1>
        </header>
        <main>
          ${this.events?.map((event, i) => this.renderEvent(event, this.events[i - 1]))}
        </main>
      </ha-card>
    `
  }

  renderEvent(event: EventInfo, prevEvent?: EventInfo) {
    const entity = this.hass.entities[event.e]
    const opts: EntityDetails = this.config.entities.find(e => typeof e !== 'string' && e.entity === event.e) as EntityDetails
    const name = opts?.name || entity.name
    const icon = opts?.icon || 'mdi:motion-sensor'

    const when = new Date(event.lu * 1000)
    const fullTs = when.toLocaleString()
    const ts = when.toLocaleTimeString('es-ES', { hour: "2-digit", minute: "2-digit" })

    const prevWhen = prevEvent && new Date(prevEvent.lu * 1000)
    const isFirstOfDay = !prevEvent || (prevWhen.getDate() !== when.getDate())
    const prefix = !isFirstOfDay ? '' : html`
      <div class="event-day-header">
        <h4>${when.toLocaleDateString([], { day: 'numeric', month: 'long', year: 'numeric' })}</h4>
      </div>
    `

    return html`
      ${prefix}
      <div class="event-entry" @click=${() => this.entityClicked(event.e)}>
        <div class="event-icon"><ha-icon icon="${icon}"></ha-icon></div>
        <div class="event-title">${name}</div>
        <div class="event-value" title="${fullTs}">${ts}</div>
      </div>
    `
  }

  entityClicked(entityId) {
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
        padding: 22px 16px 16px;
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
      h4 {
        margin: 8px 0;
      }
      main {
        margin: 12px 16px 16px;
        max-height: 250px;
        overflow-y: scroll;
      }
      main::-webkit-scrollbar {
        width: 0.4rem;
        height: 0.4rem;
      }
      main::-webkit-scrollbar-thumb {
        border-radius: 4px;
        background: var(--scrollbar-thumb-color);
      }
      .event-entry {
        display: flex;
        align-items: center;
        margin: 8px 0;
      }
      .event-icon {
        --mdc-icon-size: 24px;
        color: var(--paper-item-icon-color);
        cursor: pointer;
        height: 40px;
        width: 40px;
        line-height: 40px;
        text-align: center;
      }
      .event-title {
        cursor: pointer;
        flex: 1 1 auto;
        overflow: hidden;
        text-overflow: ellipsis;
        margin: 0 8px 0 16px;
      }
      .event-value {
        flex: 0 0 auto;
        color: var(--disabled-text-color);
        margin-right: 10px;
      }
    `
  }

}

customElements.define("events-card", EventsCard)
