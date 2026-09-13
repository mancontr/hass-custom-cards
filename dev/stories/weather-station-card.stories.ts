import type { Meta, StoryObj } from "@storybook/web-components-vite"
import { renderCardEl, computeDewPoint } from "../story-helpers"

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
    temperature: 26,
    humidity: 50,
    windSpeed: 3,
    windGust: 6,
    windBearing: 180,
    precipitationRate: 0,
    precipitationToday: 0,
    pressure: 977,
    uv: 4,
    solarRadiation: 450,
  },
  render: args => {
    const states: Record<string, { state: string, attributes?: Record<string, unknown> }> = {
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
    const config = {
      title: args.title,
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
    return renderCardEl("weather-station-card", states, config)
  },
}

export default meta
type Story = StoryObj<Args>

export const Basic: Story = {}
