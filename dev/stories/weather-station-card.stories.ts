import type { Meta, StoryObj } from "@storybook/web-components-vite"
import { renderCardEl, computeDewPoint } from "../story-helpers"
import { buildHass, MockState } from "../mocks"

interface Args {
  title: string
  temperature: number
  humidity: number
  windSpeed: number
  windGust: number
  windBearing: number
  precipitationRate: number
  precipitationToday: number
  pressure: number
  uv: number
  solarRadiation: number
}

function buildStates(args: Args): Record<string, MockState> {
  return {
    "sensor.temperature": { state: String(args.temperature), attributes: { unit_of_measurement: "°C" } },
    "sensor.dewpoint": { state: computeDewPoint(args.temperature, args.humidity).toFixed(1), attributes: { unit_of_measurement: "°C" } },
    "sensor.humidity": { state: String(args.humidity), attributes: { unit_of_measurement: "%" } },
    "sensor.wind_speed": { state: String(args.windSpeed), attributes: { unit_of_measurement: "km/h" } },
    "sensor.wind_gust": { state: String(args.windGust), attributes: { unit_of_measurement: "km/h" } },
    "sensor.wind_bearing": { state: String(args.windBearing), attributes: { unit_of_measurement: "°" } },
    "sensor.precipitation_rate": { state: String(args.precipitationRate), attributes: { unit_of_measurement: "mm/h" } },
    "sensor.precipitation_today": { state: String(args.precipitationToday), attributes: { unit_of_measurement: "mm" } },
    "sensor.pressure": { state: String(args.pressure), attributes: { unit_of_measurement: "hPa" } },
    "sensor.uv": { state: String(args.uv), attributes: { unit_of_measurement: "UV Index" } },
    "sensor.solar_radiation": { state: String(args.solarRadiation), attributes: { unit_of_measurement: "W/m²" } },
  }
}

function buildConfig(title: string) {
  return {
    title,
    temperature: "sensor.temperature",
    dewpoint: "sensor.dewpoint",
    humidity: "sensor.humidity",
    wind_speed: "sensor.wind_speed",
    wind_gust: "sensor.wind_gust",
    wind_bearing: "sensor.wind_bearing",
    precipitation_rate: "sensor.precipitation_rate",
    precipitation_today: "sensor.precipitation_today",
    pressure: "sensor.pressure",
    uv: "sensor.uv",
    solar_radiation: "sensor.solar_radiation",
  }
}

const meta: Meta<Args> = {
  title: "Cards/Weather Station",
  argTypes: {
    temperature: { control: { type: "range", min: -10, max: 40, step: 0.1 } },
    humidity: { control: { type: "range", min: 0, max: 100 } },
    windSpeed: { control: { type: "range", min: 0, max: 100 } },
    windGust: { control: { type: "range", min: 0, max: 150 } },
    windBearing: { control: { type: "range", min: 0, max: 359 } },
    precipitationRate: { control: { type: "range", min: 0, max: 50, step: 0.1 } },
    precipitationToday: { control: { type: "range", min: 0, max: 100, step: 0.1 } },
    pressure: { control: { type: "range", min: 950, max: 1050, step: 0.1 } },
    uv: { control: { type: "range", min: 0, max: 12 } },
    solarRadiation: { control: { type: "range", min: 0, max: 1000 } },
  },
  // A single representative example — every field above is a slider, so
  // walking through interesting cases is just a matter of dragging them.
  args: {
    title: "Weather Station",
    temperature: 11.3,
    humidity: 65,
    windSpeed: 3,
    windGust: 6,
    windBearing: 150,
    precipitationRate: 4.5,
    precipitationToday: 12.5,
    pressure: 986,
    uv: 4,
    solarRadiation: 450,
  },
  render: args => renderCardEl("weather-station-card", buildStates(args), buildConfig(args.title)),
}

export default meta
type Story = StoryObj<Args>

export const Basic: Story = {}

// Bearings the live story steps through: most hops cross north (or are close
// to a half turn), the cases where a naive rotation would spin the long way.
const LIVE_BEARINGS = [10, 350, 20, 330, 300, 45, 160, 200, 355, 5]

function drift(value: number, step: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value + (Math.random() * 2 - 1) * step))
}

// Unlike Basic (which builds a fresh card on every Controls change, so there
// is nothing to transition from), this keeps one card alive and pushes a new
// hass object into it every couple of seconds — the same way HA delivers
// state updates — so the graph transitions are visible. The Controls set the
// starting values; everything but the wind bearing then drifts randomly.
export const LiveUpdates: Story = {
  render: args => {
    const wrapper = renderCardEl("weather-station-card", buildStates(args), buildConfig(args.title))
    const card = wrapper.querySelector("weather-station-card") as HTMLElement & { hass: unknown }
    const current = { ...args }
    let tick = 0
    let wasConnected = false

    const timer = setInterval(() => {
      // Storybook just drops the element when switching stories; stop once it's gone.
      if (wrapper.isConnected) wasConnected = true
      else if (wasConnected) return clearInterval(timer)
      else return

      tick++
      current.temperature = drift(current.temperature, 6, -10, 40)
      current.humidity = drift(current.humidity, 15, 5, 100)
      current.windSpeed = Math.round(drift(current.windSpeed, 10, 0, 100))
      current.windGust = Math.round(Math.max(current.windSpeed, drift(current.windGust, 15, 0, 150)))
      current.windBearing = LIVE_BEARINGS[tick % LIVE_BEARINGS.length]
      current.precipitationRate = +drift(current.precipitationRate, 5, 0, 50).toFixed(1)
      current.precipitationToday = +drift(current.precipitationToday, 15, 0, 50).toFixed(1)
      current.pressure = +drift(current.pressure, 20, 970, 1050).toFixed(1)
      current.uv = Math.round(drift(current.uv, 3, 0, 12))
      current.solarRadiation = Math.round(drift(current.solarRadiation, 300, 0, 1000))
      card.hass = buildHass(buildStates(current))
    }, 2000)

    return wrapper
  },
}
