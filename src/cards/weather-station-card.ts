import { html, css, svg, LitElement } from "lit"
import L from "../intl"
import { ExtendedHomeAssistant } from "../types"

interface WeatherStationCardConfig {
  title?: string
  temperature?: string
  temperature_min?: number
  temperature_max?: number
  dewpoint?: string
  humidity?: string
  wind_speed?: string
  wind_gust?: string
  wind_bearing?: string
  precipitation_rate?: string
  precipitation_today?: string
  precipitation_rate_max?: number
  pressure?: string
  pressure_min?: number
  pressure_max?: number
  uv?: string
  uv_max?: number
  solar_radiation?: string
  solar_radiation_max?: number
}

const COMPASS_POINTS = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW']

const UV_BAND_COLORS = ['#7c3aed', '#dc2626', '#f97316', '#eab308', '#65a30d', '#16a34a'] // top (extreme) to bottom (low)

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function ratioOf(value: number, min: number, max: number): number {
  if (isNaN(value)) return 0
  return clamp((value - min) / (max - min), 0, 1)
}

function polar(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = angleDeg * Math.PI / 180
  return { x: cx + r * Math.cos(rad), y: cy - r * Math.sin(rad) }
}

// Gauge angle sweeps from 180deg (left) down to 0deg (right), passing over the top.
function gaugeAngle(ratio: number): number {
  return 180 - 180 * ratio
}

function semicircleArcPath(cx: number, cy: number, r: number): string {
  const start = polar(cx, cy, r, 180)
  const end = polar(cx, cy, r, 0)
  return `M ${start.x} ${start.y} A ${r} ${r} 0 0 1 ${end.x} ${end.y}`
}

function compassAbbr(bearing: number): string {
  const idx = Math.round((((bearing % 360) + 360) % 360) / 22.5) % 16
  return COMPASS_POINTS[idx]
}

function uvLevel(value: number, max: number): string {
  const ratio = value / max
  if (ratio >= 1) return 'extreme'
  if (ratio >= 8 / 11) return 'very-high'
  if (ratio >= 6 / 11) return 'high'
  if (ratio >= 3 / 11) return 'moderate'
  return 'low'
}

class WeatherStationCard extends LitElement {
  config: WeatherStationCardConfig
  hass: ExtendedHomeAssistant

  static getConfigElement() {
    return document.createElement("weather-station-card-editor")
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

  setConfig(config: WeatherStationCardConfig) {
    this.config = config
  }

  L(key: string): string {
    return L(this.hass, key)
  }

  render() {
    if (!this.hass || !this.config) return html``

    const title = this.config.title

    return html`
      <ha-card>
        ${title ? html`<header><h1>${title}</h1></header>` : ''}
        <main>
          ${this.config.temperature ? this.renderTemperature() : ''}
          ${this.config.wind_speed ? this.renderWind() : ''}
          ${this.config.precipitation_rate || this.config.precipitation_today ? this.renderPrecipitation() : ''}
          ${this.config.pressure ? this.renderPressure() : ''}
          ${this.config.uv ? this.renderUv() : ''}
          ${this.config.solar_radiation ? this.renderRadiation() : ''}
        </main>
      </ha-card>
    `
  }

  value(entityId: string): number {
    const state = this.hass.states[entityId]
    return state ? parseFloat(state.state) : NaN
  }

  unit(entityId: string, fallback: string): string {
    const state = this.hass.states[entityId]
    return state?.attributes?.unit_of_measurement ?? fallback
  }

  renderTile(entityId: string, titleKey: string, visual: unknown, value: unknown, unit: string, sub: string[]) {
    return html`
      <div class="tile">
        <div class="tile-title">${this.L(titleKey)}</div>
        <div class="tile-visual" @click=${() => this.entityClicked(entityId)}>
          <svg viewBox="0 0 100 90">${visual}</svg>
        </div>
        <div class="tile-value" @click=${() => this.entityClicked(entityId)}>
          <span class="tile-value-number">${value}</span>
          <span class="tile-value-unit">${unit}</span>
        </div>
        <div class="tile-sub">
          ${sub.map(line => html`<div class="tile-sub-line">${line}</div>`)}
        </div>
      </div>
    `
  }

  renderTemperature() {
    const min = this.config.temperature_min ?? -10
    const max = this.config.temperature_max ?? 40
    const temp = this.value(this.config.temperature)
    const dp = this.config.dewpoint ? this.value(this.config.dewpoint) : NaN
    const rh = this.config.humidity ? this.value(this.config.humidity) : NaN

    const cx = 50, cy = 58, r = 44
    const tempPoint = polar(cx, cy, r, gaugeAngle(ratioOf(temp, min, max)))
    const dpPoint = !isNaN(dp) ? polar(cx, cy, r, gaugeAngle(ratioOf(dp, min, max))) : null

    const visual = svg`
      <defs>
        <linearGradient id="tempGradient" x1="6" y1="0" x2="94" y2="0" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stop-color="#7c3aed" />
          <stop offset="25%" stop-color="#0ea5e9" />
          <stop offset="50%" stop-color="#22c55e" />
          <stop offset="70%" stop-color="#eab308" />
          <stop offset="85%" stop-color="#f97316" />
          <stop offset="100%" stop-color="#ef4444" />
        </linearGradient>
      </defs>
      <path d="${semicircleArcPath(cx, cy, r)}" fill="none" stroke="url(#tempGradient)" stroke-width="4" stroke-linecap="round" />
      ${dpPoint ? svg`<circle cx="${dpPoint.x}" cy="${dpPoint.y}" r="4" fill="none" stroke="var(--card-background-color, #1c1c1c)" stroke-width="2" />` : ''}
      ${!isNaN(temp) ? svg`<circle cx="${tempPoint.x}" cy="${tempPoint.y}" r="5.5" fill="#fff" stroke="var(--card-background-color, #1c1c1c)" stroke-width="2" />` : ''}
    `

    const subParts: string[] = []
    if (!isNaN(dp)) subParts.push(`${dp.toFixed(1)}° ${this.L('weather.dp')}`)
    if (!isNaN(rh)) subParts.push(`${Math.round(rh)}% ${this.L('weather.rh')}`)

    return this.renderTile(
      this.config.temperature,
      'weather.temperature',
      visual,
      isNaN(temp) ? '--.-' : temp.toFixed(1),
      this.unit(this.config.temperature, '°C'),
      subParts,
    )
  }

  renderWind() {
    const speed = this.value(this.config.wind_speed)
    const gust = this.config.wind_gust ? this.value(this.config.wind_gust) : NaN
    const bearing = this.config.wind_bearing ? this.value(this.config.wind_bearing) : NaN

    const cx = 50, cy = 45, r = 36
    const ticks = []
    for (let i = 0; i < 16; i++) {
      const angle = i * 22.5
      const isCardinal = i % 4 === 0
      const inner = polar(cx, cy, isCardinal ? r - 7 : r - 4, angle)
      const outer = polar(cx, cy, r, angle)
      ticks.push(svg`<line x1="${inner.x}" y1="${inner.y}" x2="${outer.x}" y2="${outer.y}" class="${isCardinal ? 'tick-major' : 'tick-minor'}" />`)
    }
    const labelR = r - 12
    const n = polar(cx, cy, labelR, 90)
    const e = polar(cx, cy, labelR, 0)
    const s = polar(cx, cy, labelR, 270)
    const w = polar(cx, cy, labelR, 180)
    const arrowTipY = cy - r - 4
    const arrowBackY = cy - r + 6

    const visual = svg`
      <circle cx="${cx}" cy="${cy}" r="${r}" class="compass-ring" />
      ${ticks}
      <text x="${n.x}" y="${n.y + 3}" class="compass-label">N</text>
      <text x="${e.x}" y="${e.y + 3}" class="compass-label">E</text>
      <text x="${s.x}" y="${s.y + 3}" class="compass-label">S</text>
      <text x="${w.x}" y="${w.y + 3}" class="compass-label">W</text>
      ${!isNaN(bearing) ? svg`
        <g transform="rotate(${bearing} ${cx} ${cy})">
          <path d="M ${cx} ${arrowTipY} L ${cx - 5} ${arrowBackY} L ${cx + 5} ${arrowBackY} Z" class="compass-arrow" />
        </g>
      ` : ''}
    `

    const subParts: string[] = []
    if (!isNaN(gust)) subParts.push(`${this.L('weather.gusts')} ${Math.round(gust)} ${this.unit(this.config.wind_gust, this.unit(this.config.wind_speed, 'km/h'))}`)
    if (!isNaN(bearing)) subParts.push(`${Math.round(bearing)}° ${compassAbbr(bearing)}`)

    return this.renderTile(
      this.config.wind_speed,
      'weather.wind',
      visual,
      isNaN(speed) ? '--' : Math.round(speed),
      this.unit(this.config.wind_speed, 'km/h'),
      subParts,
    )
  }

  renderPrecipitation() {
    const rateEntity = this.config.precipitation_rate
    const totalEntity = this.config.precipitation_today
    const rate = rateEntity ? this.value(rateEntity) : NaN
    const total = totalEntity ? this.value(totalEntity) : NaN
    const max = this.config.precipitation_rate_max ?? 10
    const ratio = ratioOf(rate, 0, max)

    const dropPath = "M50 6 C50 6 72 44 72 58 A22 22 0 1 1 28 58 C28 44 50 6 50 6 Z"
    const fillY = 80 - ratio * 74

    const visual = svg`
      <defs>
        <clipPath id="dropClip">
          <rect x="0" y="${fillY}" width="100" height="${80 - fillY}" />
        </clipPath>
      </defs>
      <path d="${dropPath}" class="drop-outline" />
      <path d="${dropPath}" class="drop-fill" clip-path="url(#dropClip)" />
    `

    const primaryEntity = totalEntity || rateEntity
    const primaryValue = totalEntity ? total : rate

    return this.renderTile(
      primaryEntity,
      'weather.precipitation',
      visual,
      isNaN(primaryValue) ? '--' : primaryValue.toFixed(primaryValue % 1 === 0 ? 0 : 1),
      this.unit(primaryEntity, 'mm'),
      rateEntity ? [`${isNaN(rate) ? '--' : rate.toFixed(1)} ${this.unit(rateEntity, 'mm/hr')}`] : [],
    )
  }

  renderPressure() {
    const min = this.config.pressure_min ?? 970
    const max = this.config.pressure_max ?? 1050
    const pressure = this.value(this.config.pressure)
    const ratio = ratioOf(pressure, min, max)
    const pct = ratio * 100

    const cx = 50, cy = 58, r = 44
    const path = semicircleArcPath(cx, cy, r)
    const point = polar(cx, cy, r, gaugeAngle(ratio))

    const visual = svg`
      <path d="${path}" fill="none" class="pressure-track" stroke-width="4" stroke-linecap="round" pathLength="100" />
      <path d="${path}" fill="none" class="pressure-progress" stroke-width="4" stroke-linecap="round" pathLength="100" stroke-dasharray="${pct} 100" />
      ${!isNaN(pressure) ? svg`<circle cx="${point.x}" cy="${point.y}" r="5" class="pressure-marker" />` : ''}
    `

    return this.renderTile(
      this.config.pressure,
      'weather.pressure',
      visual,
      isNaN(pressure) ? '--' : Math.round(pressure),
      this.unit(this.config.pressure, 'hPa'),
      [],
    )
  }

  renderUv() {
    const uv = this.value(this.config.uv)
    const max = this.config.uv_max ?? 11
    const bandCount = UV_BAND_COLORS.length
    const filledFromBottom = clamp(Math.round(ratioOf(uv, 0, max) * bandCount), 0, bandCount)
    const bandHeight = 76 / bandCount

    const bands = UV_BAND_COLORS.map((color, i) => {
      const filled = (bandCount - i) <= filledFromBottom
      return svg`
        <rect
          x="10" y="${9 + i * bandHeight}" width="80" height="${bandHeight}"
          clip-path="url(#uvClip)"
          fill="${filled ? color : 'var(--disabled-text-color)'}"
          opacity="${filled ? 1 : 0.25}"
        />
      `
    })

    const visual = svg`
      <defs>
        <clipPath id="uvClip">
          <path d="M50 9 L90 85 L10 85 Z" />
        </clipPath>
      </defs>
      ${bands}
    `

    return this.renderTile(
      this.config.uv,
      'weather.uv',
      visual,
      isNaN(uv) ? '--' : Math.round(uv),
      '',
      [this.L(`weather.uv.${uvLevel(uv, max)}`)],
    )
  }

  renderRadiation() {
    const radiation = this.value(this.config.solar_radiation)
    const max = this.config.solar_radiation_max ?? 1000
    const ratio = ratioOf(radiation, 0, max)
    const sunR = 4 + ratio * 26
    const color = ratio < 0.5
      ? `color-mix(in srgb, #fde68a ${100 - ratio * 200}%, #f97316 ${ratio * 200}%)`
      : `color-mix(in srgb, #f97316 ${100 - (ratio - 0.5) * 200}%, #dc2626 ${(ratio - 0.5) * 200}%)`

    const visual = svg`
      <circle cx="50" cy="45" r="40" class="radiation-ring" />
      ${!isNaN(radiation) ? svg`
        <circle cx="50" cy="45" r="${sunR * 1.7}" fill="${color}" opacity="0.25" />
        <circle cx="50" cy="45" r="${sunR}" fill="${color}" />
      ` : ''}
    `

    return this.renderTile(
      this.config.solar_radiation,
      'weather.radiation',
      visual,
      isNaN(radiation) ? '--' : Math.round(radiation),
      this.unit(this.config.solar_radiation, 'W/m²'),
      [],
    )
  }

  entityClicked(entityId: string) {
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
        display: block;
        color: var(--primary-text-color,inherit);
        container-type: inline-size;
        container-name: weather-station-card;
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
        display: grid;
        grid-template-columns: repeat(6, 1fr);
        gap: 12px 6px;
        padding: 16px 8px;
      }
      /* HA switches its dashboards to a single narrow column below this
         viewport width (see hui-masonry-view / hui-sections-view), which is
         a more reliable "is this a phone" signal than the card's own
         rendered width: HA's own column width can range from ~320 to
         500px on both phone and desktop layouts. */
      @media (max-width: 600px) {
        main {
          grid-template-columns: repeat(3, 1fr);
          gap: 20px 8px;
        }
        .tile-title {
          font-size: 11px;
        }
        .tile-visual {
          max-width: 96px;
        }
        .tile-value-number {
          font-size: 26px;
        }
        .tile-value-unit {
          font-size: 13px;
        }
        .tile-sub {
          font-size: 11px;
          min-height: 14px;
        }
      }
      /* Backup for when the card itself is squeezed narrower than that
         (e.g. inside a layout-card column) even on a wide viewport. */
      @container weather-station-card (max-width: 400px) {
        main {
          grid-template-columns: repeat(3, 1fr);
          gap: 20px 8px;
        }
        .tile-title {
          font-size: 11px;
        }
        .tile-visual {
          max-width: 96px;
        }
        .tile-value-number {
          font-size: 26px;
        }
        .tile-value-unit {
          font-size: 13px;
        }
        .tile-sub {
          font-size: 11px;
          min-height: 14px;
        }
      }
      .tile {
        display: flex;
        flex-direction: column;
        align-items: center;
        text-align: center;
        min-width: 0;
      }
      .tile-title {
        color: var(--secondary-text-color);
        font-size: 10px;
        font-weight: 600;
        letter-spacing: 0.04em;
        text-transform: uppercase;
        margin-bottom: 6px;
      }
      .tile-visual {
        width: 100%;
        max-width: 72px;
        aspect-ratio: 100 / 90;
        cursor: pointer;
      }
      .tile-visual svg {
        display: block;
        width: 100%;
        height: 100%;
      }
      .tile-value {
        cursor: pointer;
        margin-top: 4px;
        white-space: nowrap;
      }
      .tile-value-number {
        font-size: 20px;
        font-weight: 500;
      }
      .tile-value-unit {
        font-size: 11px;
        color: var(--secondary-text-color);
        margin-left: 1px;
      }
      .tile-sub {
        font-size: 9.5px;
        color: var(--secondary-text-color);
        text-transform: uppercase;
        margin-top: 2px;
        min-height: 12px;
      }
      .tile-sub-line {
        white-space: nowrap;
      }
      .compass-ring {
        fill: none;
        stroke: var(--disabled-text-color);
        stroke-width: 1;
        opacity: 0.4;
      }
      .tick-major {
        stroke: var(--secondary-text-color);
        stroke-width: 1.5;
      }
      .tick-minor {
        stroke: var(--disabled-text-color);
        stroke-width: 1;
      }
      .compass-label {
        fill: var(--secondary-text-color);
        font-size: 11px;
        font-weight: 600;
        text-anchor: middle;
      }
      .compass-arrow {
        fill: var(--primary-color, #f97316);
      }
      .drop-outline {
        fill: none;
        stroke: var(--disabled-text-color);
        stroke-width: 2;
        opacity: 0.5;
      }
      .drop-fill {
        fill: #0ea5e9;
      }
      .pressure-track {
        stroke: var(--disabled-text-color);
        opacity: 0.3;
      }
      .pressure-progress {
        stroke: var(--primary-color, #0ea5e9);
      }
      .pressure-marker {
        fill: #fff;
        stroke: var(--card-background-color, #1c1c1c);
        stroke-width: 2;
      }
      .radiation-ring {
        fill: var(--disabled-text-color);
        opacity: 0.12;
      }
    `
  }

}

customElements.define("weather-station-card", WeatherStationCard)
