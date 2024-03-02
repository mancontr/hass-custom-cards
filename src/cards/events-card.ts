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
  group?: string
}

type EntityDetailsOrId = EntityDetails | string

interface RawEventInfo {
  s: 'on' | 'off' | 'unknown' // State
  lu: number // Timestamp
}

interface EventInfo {
  entityId: string
  ts: number
  date: Date
  isFirstOfDay?: boolean
  grouped?: EventInfo[]
  groupLastTs?: number
  removed?: boolean
}

class EventsCard extends LitElement {
  config: EventsCardConfig
  hass: ExtendedHomeAssistant
  entityConfig: Map<string, EntityDetails>
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
      entityConfig: {},
      events: {},
    }
  }

  constructor() {
    super()
  }

  setConfig(config: EventsCardConfig) {
    this.config = config
    this.entityConfig = new Map<string, EntityDetails>()
    this.config.entities.forEach(e => {
      if (typeof e === 'string') {
        this.entityConfig.set(e, { entity: e })
      } else {
        this.entityConfig.set(e.entity, e)
      }
    })
  }

  L(key: string): string {
    return L(this.hass, key)
  }

  async firstUpdated() {
    const ids = this.config?.entities.map(e => typeof e === 'string' ? e : e.entity)
    const start = new Date()
    start.setDate(start.getDate() - 1) // 1 day of activity
    // Get the events
    const rawEvents: {[x: string]: RawEventInfo[]} = await this.hass.callWS({
      type: 'history/history_during_period',
      entity_ids: ids,
      start_time: start.toISOString(),
      end_time: new Date().toISOString(),
      minimal_response: true,
      no_attributes: true,
      significant_changes_only: true,
    }) || {}
    // Merge all events together and sort by date
    const events: EventInfo[] = []
    ids.forEach(id => {
      rawEvents[id] && events.push(...rawEvents[id]
        .filter(evt => evt.s === 'on')
        .map(evt => ({
          entityId: id,
          ts: evt.lu,
          date: new Date(evt.lu * 1000)
        }))
      )
    })
    events.sort((a, b) => b.ts - a.ts)
    // Group them as needed and mark first of day, removed
    const groupEvt = new Map<string, EventInfo>()
    let lastDay: number = null
    for (const evt of events) {
      // First of day?
      const evtDate = evt.date.getDate()
      if (lastDay === null || evtDate !== lastDay) {
        lastDay = evtDate
        evt.isFirstOfDay = true
      }
      // Can be grouped?
      const groupingRange = 300 // TODO: Configurable?
      const entityCfg = this.entityConfig.get(evt.entityId)
      const group = entityCfg.group
      if (group) {
        const lastEvtGroup = groupEvt.get(group)
        const lastEvtTs = lastEvtGroup && (lastEvtGroup.groupLastTs || lastEvtGroup.ts)
        const canGroup = lastEvtGroup && (lastEvtTs - evt.ts) <= groupingRange
        if (canGroup) {
          lastEvtGroup.grouped = lastEvtGroup.grouped || []
          lastEvtGroup.grouped.push(evt)
          lastEvtGroup.groupLastTs = evt.ts
          evt.removed = true
        } else {
          groupEvt.set(group, evt)
        }
      }
    }
    // Remove all "removed" events
    this.events = events.filter(e => !e.removed)
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
    const entity = this.hass.entities[event.entityId]
    const opts: EntityDetails = this.entityConfig.get(event.entityId)
    const name = opts.name || entity.name
    const icon = opts.icon || 'mdi:motion-sensor'

    const fullTs = event.date.toLocaleString()
    const ts = event.date.toLocaleTimeString('es-ES', { hour: "2-digit", minute: "2-digit" })

    const prefix = !event.isFirstOfDay ? '' : html`
      <div class="event-day-header">
        <h4>${event.date.toLocaleDateString([], { day: 'numeric', month: 'long', year: 'numeric' })}</h4>
      </div>
    `

    return html`
      ${prefix}
      <div class="event-entry">
        <div class="event-icon" @click=${() => this.eventClicked(event)}>
          <ha-icon icon="${icon}" />
        </div>
        <div class="event-title">
          <span class="entity" @click=${() => this.eventClicked(event)}>
            ${name}
          </span>
          ${event.grouped?.length > 0
            ? html`<span class="note"> (y ${event.grouped.length} más)</span>`
            : ''
          }
        </div>
        <div class="event-value" title="${fullTs}">${ts}</div>
      </div>
    `
  }

  eventClicked(evt: EventInfo) {
    console.log('Click:', evt)
    const event = new CustomEvent('hass-more-info', {
      bubbles: true,
      composed: true,
      detail: { entityId: evt.entityId },
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
        flex: 1 1 auto;
        overflow: hidden;
        text-overflow: ellipsis;
        margin: 0 8px 0 16px;
      }
      .event-title .entity {
        cursor: pointer;
        color: var(--primary-color)
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
