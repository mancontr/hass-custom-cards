import { html, css, LitElement } from "lit"
import L from "../intl"
import { EntityHistoryEntry, ExtendedHomeAssistant } from "../types"
import { findEntities, formTexts, label, registerCard } from "../editor"

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
  config!: EventsCardConfig
  hass!: ExtendedHomeAssistant
  entityConfig!: Map<string, EntityDetails>
  events!: EventInfo[]
  expandedGroupTs?: number

  private fetchId = 0

  static getConfigForm() {
    const text = (name: string) => label("events.editor", name)
    return {
      schema: [
        { name: "title", selector: { text: {} } },
        {
          name: "entities",
          required: true,
          selector: {
            object: {
              multiple: true,
              label_field: "entity",
              fields: {
                entity: { label: text("entity"), required: true, selector: { entity: { filter: { domain: "binary_sensor" } } } },
                name: { label: text("name"), selector: { text: {} } },
                icon: { label: text("icon"), selector: { icon: {} } },
                group: { label: text("group"), selector: { text: {} } },
              },
            },
          },
        },
      ],
      // The object selector only handles `- entity: ...` entries, not the
      // shorthand of a bare entity id: those configs stay YAML-only.
      assertConfig: (config: EventsCardConfig) => {
        if ((config.entities || []).some(e => typeof e === "string")) {
          throw new Error(text("string_entities"))
        }
      },
      ...formTexts("events.editor"),
    }
  }

  static getStubConfig(hass: ExtendedHomeAssistant, unused?: string[]) {
    const entities = findEntities(hass, unused, "binary_sensor", ["motion", "occupancy", "door"], 3)
    return {
      entities: entities.map(entity => ({ entity })),
    }
  }

  static get properties() {
    return {
      hass: {},
      config: {},
      entityConfig: {},
      events: {},
      expandedGroupTs: {},
    }
  }

  constructor() {
    super()
  }

  setConfig(config: EventsCardConfig) {
    this.config = config
    this.entityConfig = new Map<string, EntityDetails>()
    // Tolerates a half-filled config (as while editing it).
    ;(this.config.entities || []).filter(Boolean).forEach(e => {
      if (typeof e === 'string') {
        this.entityConfig.set(e, { entity: e })
      } else if (e.entity) {
        this.entityConfig.set(e.entity, e)
      }
    })
    // HA reuses the element when the config changes (e.g. live in the
    // editor's preview), so the events must be fetched again.
    if (this.hasUpdated) this.fetchEvents()
  }

  L(key: string, params?: { [k: string]: string | number }): string {
    return L(this.hass, key, params)
  }

  get locale(): string {
    return this.hass.locale?.language || this.hass.language || 'en'
  }

  firstUpdated() {
    this.fetchEvents()
  }

  async fetchEvents() {
    // Only the latest fetch wins, if several overlap (e.g. while typing).
    const fetchId = ++this.fetchId
    const ids = [...this.entityConfig.keys()]
    if (!ids.length) {
      this.events = []
      return
    }
    const start = new Date()
    start.setDate(start.getDate() - 1) // 1 day of activity
    // Get the events
    let rawEvents: {[x: string]: RawEventInfo[]}
    try {
      rawEvents = await this.hass.callWS<{[x: string]: RawEventInfo[]}>({
        type: 'history/history_during_period',
        entity_ids: ids,
        start_time: start.toISOString(),
        end_time: new Date().toISOString(),
        minimal_response: true,
        no_attributes: true,
        significant_changes_only: true,
      }) || {}
    } catch (err) {
      console.warn('Events: could not fetch history:', err)
      return
    }
    if (fetchId !== this.fetchId) return
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
    let lastDay: number | null = null
    for (const evt of events) {
      // First of day?
      const evtDate = evt.date.getDate()
      if (lastDay === null || evtDate !== lastDay) {
        lastDay = evtDate
        evt.isFirstOfDay = true
      }
      // Can be grouped?
      const groupingRange = 300 // TODO: Configurable?
      const group = this.entityConfig.get(evt.entityId)?.group
      if (group) {
        const lastEvtGroup = groupEvt.get(group)
        const canGroup = lastEvtGroup !== undefined
          && (lastEvtGroup.groupLastTs || lastEvtGroup.ts) - evt.ts <= groupingRange
          && evt.date.toDateString() === lastEvtGroup.date.toDateString()
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
    const opts = this.entityConfig.get(event.entityId) || { entity: event.entityId }
    const name = opts.name || entity?.name || event.entityId
    const icon = opts.icon || 'mdi:motion-sensor'

    const fullTs = event.date.toLocaleString()
    const ts = event.date.toLocaleTimeString(this.locale, { hour: "2-digit", minute: "2-digit" })

    const prefix = !event.isFirstOfDay ? '' : html`
      <div class="event-day-header">
        <h4>${event.date.toLocaleDateString(this.locale, { day: 'numeric', month: 'long', year: 'numeric' })}</h4>
      </div>
    `

    const grouped = event.grouped
    const isExpanded = grouped !== undefined && grouped.length > 0 && this.expandedGroupTs === event.ts

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
          ${grouped !== undefined && grouped.length > 0
            ? html`
              <span class="note" @click=${() => this.toggleGroup(event)}>
                ${this.L('events.grouped', { count: grouped.length })}
              </span>
            `
            : ''
          }
        </div>
        <div class="event-value" title="${fullTs}">${ts}</div>
      </div>
      ${isExpanded ? grouped.map(subEvent => this.renderSubEvent(subEvent)) : ''}
    `
  }

  renderSubEvent(event: EventInfo) {
    const entity = this.hass.entities[event.entityId]
    const opts = this.entityConfig.get(event.entityId) || { entity: event.entityId }
    const name = opts.name || entity?.name || event.entityId
    const icon = opts.icon || 'mdi:motion-sensor'

    const fullTs = event.date.toLocaleString()
    const ts = event.date.toLocaleTimeString(this.locale, { hour: "2-digit", minute: "2-digit" })

    return html`
      <div class="event-entry event-entry--sub">
        <div class="event-icon" @click=${() => this.eventClicked(event)}>
          <ha-icon icon="${icon}" />
        </div>
        <div class="event-title">
          <span class="entity" @click=${() => this.eventClicked(event)}>
            ${name}
          </span>
        </div>
        <div class="event-value" title="${fullTs}">${ts}</div>
      </div>
    `
  }

  toggleGroup(event: EventInfo) {
    this.expandedGroupTs = this.expandedGroupTs === event.ts ? undefined : event.ts
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
      .note {
        cursor: pointer;
        text-decoration: underline dotted;
      }
      .event-entry--sub {
        margin-left: 40px;
        opacity: 0.8;
      }
      .event-entry--sub .event-icon {
        --mdc-icon-size: 18px;
        height: 30px;
        width: 30px;
        line-height: 30px;
      }
    `
  }

}

customElements.define("events-card", EventsCard)
registerCard("events-card", "Events Card", "Recent activity of binary sensors, grouping events close in time.")
