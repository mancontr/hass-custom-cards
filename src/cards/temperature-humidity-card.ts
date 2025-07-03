import { html, css, LitElement } from "lit"
import { ExtendedHomeAssistant } from "../types"

interface TemperatureHumidityCardConfig {
  title: string
  temperature: string
  humidity: string
}

class TemperatureHumidityCard extends LitElement {
  config: TemperatureHumidityCardConfig
  hass: ExtendedHomeAssistant

  static getConfigElement() {
    return document.createElement("temperature-humidity-card-editor")
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
    }
  }

  constructor() {
    super()
  }

  setConfig(config: TemperatureHumidityCardConfig) {
    this.config = config
  }

  render() {
    if (!this.hass || !this.config) return html``

    const temp = parseFloat(this.hass.states[this.config.temperature].state)
    const hum = parseFloat(this.hass.states[this.config.humidity].state)

    return html`
      <ha-card>
        <header>
          <h1>
            ${this.config.title}
          </h1>
        </header>
        <main>
          <div class="temperature" @click=${() => this.entityClicked(this.config.temperature)}>
            <ha-icon icon="mdi:thermometer"></ha-icon>
            <span class="value">
              ${isNaN(temp) ? '--.-' : (Math.round(temp * 10) / 10).toFixed(1)}
            </span>
            <span class="units">ºC</span>
          </div>
          <div class="humidity" @click=${() => this.entityClicked(this.config.humidity)}>
            <ha-icon icon="mdi:water-percent"></ha-icon>
            <span class="value">
              ${isNaN(hum) ? '--' : Math.round(hum)}
            </span>
            <span class="units">%</span>
          </div>
        </main>
      </ha-card>
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
        padding: 20px 16px 0;
      }
      h1 {
        color: var(--secondary-text-color);
        font-family: var(--ha-card-header-font-family,inherit);
        font-size: 16px;
        letter-spacing: -0.012em;
        line-height: 16px;
        font-weight: 500;
        margin: 0;
      }
      main {
        display: flex;
        justify-content: space-between;
        padding: 16px;
      }
      ha-icon {
        --mdc-icon-size: 24px;
        color: var(--paper-item-icon-color);
        text-align: center;
      }
      .temperature, .humidity {
        cursor: pointer;
        display: flex;
        align-items: center;
      }
      .temperature .value {
        font-size: 28px;
      }
      .temperature .units {
        margin-bottom: 10px;
      }
      .units {
        color: var(--secondary-text-color);
        margin-left: 3px;
      }
    `
  }

}

customElements.define("temperature-humidity-card", TemperatureHumidityCard)
