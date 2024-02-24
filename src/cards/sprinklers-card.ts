import { html, css, LitElement } from "lit"
import L from "../intl"
import { EntityHistoryEntry, ExtendedHomeAssistant } from "../types"

interface SprinklersCardConfig {
  title?: string
  colTitles?: string[]
  general: {
    switch: string
    multi: string
  }
  valves: ValveEntry[]
}

interface ValveEntry {
  name: string
  duration: string
  enabled: string
  switch: string
}

interface IdTsMap {
  [id: string]: number
}

class SprinklersCard extends LitElement {
  lastOn: IdTsMap
  showModal: boolean
  config: SprinklersCardConfig
  hass: ExtendedHomeAssistant

  static getConfigElement() {
    return document.createElement("sprinklers-card-editor")
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
      lastOn: { type: Object },
      showModal: { type: Boolean },
    }
  }

  constructor() {
    super()
    this.lastOn = {}
    this.showModal = false
  }

  setConfig(config: SprinklersCardConfig) {
    this.config = config
  }

  firstUpdated() {
    this.getSwitchLastOn([this.config.general.switch])
      .catch(err => {
        console.warn('Sprinklers: could not fetch main switch history:', err)
      })
  }

  L(key: string): string {
    return L(this.hass, key)
  }

  getSwitchLastOn(ids: string[]): Promise<IdTsMap> {
    const start = new Date()
    start.setMonth(start.getMonth() - 1)
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
      const out: IdTsMap = {}
      for (const id of ids) {
        const lastOn = this.getLastOnTs(res[id] || [])
        out[id] = lastOn ? lastOn * 1000 : null
      }
      return out
    })
    .then(res => {
      this.lastOn = {
        ...this.lastOn,
        ...res
      }
      return res
    })
  }

  getLastOnTs(history: EntityHistoryEntry[]) {
    let lastOnTs: number | null = null
    let wasOn = false
    for (let i = 0; i < history.length; i++) {
      const change = history[i]
      if (change.s === "on") {
        lastOnTs = Date.now()
        wasOn = true
      } else if (wasOn) {
        lastOnTs = change.lu
        wasOn = false
      }
    }
    return lastOnTs
  }

  render() {
    if (!this.hass || !this.config) return html``

    const mainState = this.hass.states[this.config.general.switch]
    if (!mainState) return html``

    const title = this.config.title || this.L('sprinklers.title')
    const isActive = mainState.state === 'on'

    return html`
      <ha-card>
        <header>
          <h1>
            ${title}
          </h1>
          <div class="settings" @click=${this.settingsClicked}>
            <ha-icon icon="mdi:cog"></ha-icon>
          </div>
        </header>
        <main>
          <div class="status ${isActive ? 'on' : 'off'}" @click=${this.statusClicked}>
            <ha-icon icon="mdi:sprinkler"></ha-icon>
          </div>
          <div class="details">
            ${isActive ? this.renderDetailsActive() : this.renderDetailsIdle()}
          </div>
        </main>
        ${this.showModal ? this.renderModal() : null}
      </ha-card>
    `
  }

  renderDetailsActive() {
    const current = this.config.valves.find(valve => this.hass.states[valve.switch].state === 'on')
    return html`
      <div class="details-row current">
        <div class="details-title">${this.L('sprinklers.watering')}</div>
        <div class="details-value">${current?.name || this.L('sprinklers.unknown')}</div>
      </div>
    `
  }

  renderDetailsIdle() {
    const sw = this.config.general.switch
    const lastChange = this.lastOn[sw]
    return html`
      <div class="details-row last-active">
        <div class="details-title">${this.L('sprinklers.last-watered')}</div>
        <div class="details-value">
          <ha-relative-time .hass=${this.hass} .datetime="${lastChange}" />
        </div>
      </div>
    `
  }

  renderModal() {
    const title = this.config.title || this.L('sprinklers.title')
    return html`
      <ha-dialog open flexContent hideActions .heading=${title} @closed=${this.settingsClosed}>
        <table>
          <thead>
            <tr>
              <th>${this.config.colTitles?.[0] || this.L('sprinklers.valve.zone')}</th>
              <th>${this.config.colTitles?.[1] || this.L('sprinklers.valve.enabled')}</th>
              <th>${this.config.colTitles?.[2] || this.L('sprinklers.valve.duration')}</th>
              <th>${this.config.colTitles?.[3] || this.L('sprinklers.valve.active')}</th>
              <th>${this.config.colTitles?.[4] || this.L('sprinklers.valve.last-watered')}</th>
            </tr>
          </thead>
          <tbody>
            ${this.config.valves.map(valve => html`
              <tr>
                <td>${valve.name || this.hass.entities[valve.switch].name}</td>
                <td><ha-entity-toggle .hass=${this.hass} .stateObj=${this.hass.states[valve.enabled]} /></td>
                <td><input type="number" disabled value=${parseInt(this.hass.states[valve.duration].state)} /></td>
                <td><ha-entity-toggle .hass=${this.hass} .stateObj=${this.hass.states[valve.switch]} /></td>
                <td><ha-relative-time .hass=${this.hass} .datetime=${this.lastOn[valve.switch]} /></td>
              </tr>
            `)}
          </tbody>
        </table>
      </ha-dialog>
    `
  }

  statusClicked() {
    const mainState = this.hass.states[this.config.general.switch]
    const service = mainState.state === "on" ? "turn_off" : "turn_on"
    this.hass.callService("switch", service, { entity_id: this.config.general.switch })
  }

  settingsClicked() {
    this.showModal = true
    this.getSwitchLastOn(this.config.valves.map(valve => valve.switch))
  }

  settingsClosed() {
    this.showModal = false
  }

  static get styles() {
    return css`
      ha-card {
        color: var(--primary-text-color,inherit);
      }
      header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 12px 16px 16px;
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
      .settings {
        cursor: pointer;
        --mdc-icon-size: 20px;
      }
      main {
        display: flex;
        align-items: center;
        padding: 16px;
        padding-top: 0;
      }
      .status {
        background-color: var(--secondary-background-color);
        border-radius: 100%;
        color: var(--state-switch-off-color, var(--state-switch-inactive-color, var(--state-inactive-color)));
        cursor: pointer;
        flex: 0 0 auto;
        margin-right: 16px;
        padding: 10px;
        --mdc-icon-size: 32px;
      }
      .status.on {
        color: var(--state-switch-on-color, var(--state-switch-active-color, var(--state-active-color)));
      }
      .details {
        flex: 1 1 auto;
        font-size: 14px;
      }
      .details-value {
        color: var(--secondary-text-color);
        font-size: 12px;
      }
      ha-dialog th {
        text-align: left;
      }
      ha-dialog table {
        border-spacing: 10px 0;
      }
      ha-dialog input {
        width: 40px;
      }
    `
  }

}

customElements.define("sprinklers-card", SprinklersCard)
