import type { Meta, StoryObj } from "@storybook/web-components-vite"
import { renderCardEl, renderHorizontalStackEl, FULL_COLUMN_WIDTH, HALF_COLUMN_WIDTH } from "../story-helpers"

interface Args {
  layout: "full" | "half"
  title: string
  temperature: number
  humidity: number
  unavailable: boolean
  hasOutdoorRef: boolean
  outdoorTemperature: number
  outdoorHumidity: number
}

const meta: Meta<Args> = {
  title: "Cards/Temperature Humidity",
  argTypes: {
    layout: {
      control: { type: "radio" },
      options: ["full", "half"],
      description: `Full column (fills up to ${FULL_COLUMN_WIDTH}px, HA's own cap) or half — shown twice side by side, like a real 2-up Horizontal Stack (~${HALF_COLUMN_WIDTH}px each).`,
    },
    temperature: { control: { type: "range", min: -10, max: 40, step: 0.1 } },
    humidity: { control: { type: "range", min: 0, max: 100 } },
    unavailable: { control: "boolean", description: "Point temperature/humidity at entities with no state, like a real unavailable sensor" },
    hasOutdoorRef: { control: "boolean", description: "Configure an outdoor reference, enabling the ventilation badge" },
    outdoorTemperature: { control: { type: "range", min: -10, max: 40, step: 0.1 }, if: { arg: "hasOutdoorRef" } },
    outdoorHumidity: { control: { type: "range", min: 0, max: 100 }, if: { arg: "hasOutdoorRef" } },
  },
  args: {
    layout: "full",
    title: "Kitchen",
    temperature: 22,
    humidity: 58,
    unavailable: false,
    hasOutdoorRef: true,
    outdoorTemperature: 21,
    outdoorHumidity: 48,
  },
  render: args => {
    const states: Record<string, { state: string }> = {}
    const config: Record<string, unknown> = { title: args.title }

    if (!args.unavailable) {
      states["sensor.temperature"] = { state: String(args.temperature) }
      states["sensor.humidity"] = { state: String(args.humidity) }
    }
    config.temperature = "sensor.temperature"
    config.humidity = "sensor.humidity"

    if (args.hasOutdoorRef) {
      states["sensor.outdoor_temperature"] = { state: String(args.outdoorTemperature) }
      states["sensor.outdoor_humidity"] = { state: String(args.outdoorHumidity) }
      config.outdoor_temperature = "sensor.outdoor_temperature"
      config.outdoor_humidity = "sensor.outdoor_humidity"
    }

    if (args.layout === "half") {
      // Shown twice, side by side, the way a real Horizontal Stack actually
      // looks — a single isolated half-width card doesn't tell you much
      // about how it reads next to its neighbor.
      return renderHorizontalStackEl("temperature-humidity-card", states, config, config)
    }
    return renderCardEl("temperature-humidity-card", states, config, FULL_COLUMN_WIDTH)
  },
}

export default meta
type Story = StoryObj<Args>

// The main playground: slide temperature/humidity/outdoor values to walk
// through all 5 ventilation bands live instead of picking through separate
// stories for each one.
export const Basic: Story = {}

// Cases below change the card's actual structure, not just values, so they
// aren't reachable by sliding the controls above.
export const NoOutdoorRef: Story = { args: { title: "No outdoor ref", hasOutdoorRef: false } }
export const Unavailable: Story = { args: { title: "No data", unavailable: true, hasOutdoorRef: false } }
export const HorizontalStackHalf: Story = { args: { title: "Half column", layout: "half" } }
