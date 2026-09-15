import { html, css, LitElement } from "lit"
import L from "../intl"
import { ExtendedHomeAssistant } from "../types"

interface TemperatureHumidityCardConfig {
  title: string
  temperature: string
  humidity: string
  outdoor_temperature?: string
  outdoor_humidity?: string
  ventilation_mild_threshold?: number
  ventilation_strong_threshold?: number
}

interface VentilationState {
  key: string
  icon: string
  color: string
}

// Magnus-Tetens approximation, valid for the usual indoor/outdoor range.
function dewPoint(tempC: number, rh: number): number {
  const b = 17.62, c = 243.12
  const gamma = Math.log(rh / 100) + (b * tempC) / (c + tempC)
  return (c * gamma) / (b - gamma)
}

// Vaisala's absolute humidity approximation, in g/m3.
function absoluteHumidity(tempC: number, rh: number): number {
  const saturationVaporPressure = 6.112 * Math.exp((17.67 * tempC) / (tempC + 243.5))
  return (saturationVaporPressure * rh * 2.1674) / (273.15 + tempC)
}

// A continuous green -> red hue progression rather than a flat "good/bad" pair,
// so the 5 states read as points along a gradient instead of a binary signal.
const VENTILATION_STATES: VentilationState[] = [
  { key: 'dire', icon: 'mdi:fan', color: '#ff4040' },
  { key: 'could', icon: 'mdi:fan', color: '#b7531d' },
  { key: 'neutral', icon: 'mdi:fan', color: '#444444' },
  { key: 'avoid', icon: 'mdi:fan-off', color: '#336893' },
  { key: 'dont', icon: 'mdi:fan-off', color: '#4e9fe1' },
]

function ventilationState(diff: number, mild: number, strong: number): VentilationState {
  if (diff > strong) return VENTILATION_STATES[0]
  if (diff > mild) return VENTILATION_STATES[1]
  if (diff >= -mild) return VENTILATION_STATES[2]
  if (diff >= -strong) return VENTILATION_STATES[3]
  return VENTILATION_STATES[4]
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

  L(key: string): string {
    return L(this.hass, key)
  }

  value(entityId: string): number {
    const state = this.hass.states[entityId]
    return state ? parseFloat(state.state) : NaN
  }

  computeVentilation(indoorTemp: number, indoorHum: number): { state: VentilationState } | null {
    const { outdoor_temperature, outdoor_humidity } = this.config
    if (!outdoor_temperature || !outdoor_humidity) return null
    if (isNaN(indoorTemp) || isNaN(indoorHum)) return null

    const outdoorTemp = this.value(outdoor_temperature)
    const outdoorHum = this.value(outdoor_humidity)
    if (isNaN(outdoorTemp) || isNaN(outdoorHum)) return null

    const diff = absoluteHumidity(indoorTemp, indoorHum) - absoluteHumidity(outdoorTemp, outdoorHum)
    const mild = this.config.ventilation_mild_threshold ?? 1
    const strong = this.config.ventilation_strong_threshold ?? 3

    return { state: ventilationState(diff, mild, strong) }
  }

  render() {
    if (!this.hass || !this.config) return html``

    const temp = this.value(this.config.temperature)
    const hum = this.value(this.config.humidity)
    const dp = !isNaN(temp) && !isNaN(hum) ? dewPoint(temp, hum) : NaN

    const ventilation = this.computeVentilation(temp, hum)

    return html`
      <ha-card>
        <header>
          <h1>
            ${this.config.title}
          </h1>
          <div
            class="ventilation-badge ${ventilation ? '' : 'ventilation-badge--hidden'}"
            style=${ventilation ? `background: ${ventilation.state.color}26; color: ${ventilation.state.color};` : ''}
            title=${ventilation ? this.L(`temp_humidity.ventilation.${ventilation.state.key}`) : ''}
          >
            ${ventilation ? html`<ha-icon icon="${ventilation.state.icon}"></ha-icon>` : ''}
          </div>
        </header>
        <main>
          <div class="temperature" @click=${() => this.entityClicked(this.config.temperature)}>
            <ha-icon icon="mdi:thermometer"></ha-icon>
            <span class="value">
              ${isNaN(temp) ? '--.-' : (Math.round(temp * 10) / 10).toFixed(1)}
            </span>
            <span class="units">ºC</span>
          </div>
          <div class="humidity-block">
            <div class="humidity" @click=${() => this.entityClicked(this.config.humidity)}>
              <ha-icon icon="mdi:water-percent"></ha-icon>
              <span class="value">
                ${isNaN(hum) ? '--' : Math.round(hum)}
              </span>
              <span class="units">%</span>
            </div>
            <div class="dewpoint-note">${this.L('temp_humidity.dew_point')} ${isNaN(dp) ? '--.-' : dp.toFixed(1)}º</div>
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
        display: flex;
        align-items: center;
        justify-content: space-between;
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
      .ventilation-badge {
        --mdc-icon-size: 18px;
        display: flex;
        align-items: center;
        justify-content: center;
        width: 28px;
        height: 28px;
        border-radius: 50%;
        flex: 0 0 auto;
      }
      .ventilation-badge ha-icon {
        color: inherit;
      }
      .ventilation-badge--hidden {
        visibility: hidden;
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
      .humidity-block {
        display: flex;
        flex-direction: column;
        align-items: flex-end;
      }
      .dewpoint-note {
        font-size: 10px;
        color: var(--secondary-text-color);
        margin-top: 2px;
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
