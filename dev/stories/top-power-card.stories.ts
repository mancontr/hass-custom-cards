import type { Meta, StoryObj } from "@storybook/web-components-vite"
import { renderCardEl } from "../story-helpers"

interface Args {
  title: string
  circuitAPower: number
  circuitBPower: number
  circuitCPower: number
  circuitDPower: number
  idleThreshold: number
  highThreshold: number
}

const meta: Meta<Args> = {
  title: "Cards/Top Power",
  argTypes: {
    circuitAPower: { control: { type: "range", min: 0, max: 2000 } },
    circuitBPower: { control: { type: "range", min: 0, max: 2000 } },
    circuitCPower: { control: { type: "range", min: 0, max: 2000 } },
    circuitDPower: { control: { type: "range", min: 0, max: 2000 } },
    idleThreshold: { control: { type: "number", min: 0 } },
    highThreshold: { control: { type: "number", min: 0 } },
  },
  args: {
    title: "Power",
    circuitAPower: 1800,
    circuitBPower: 120,
    circuitCPower: 85,
    circuitDPower: 2,
    idleThreshold: 5,
    highThreshold: 300,
  },
  render: args => {
    // Total is the sum of the circuits, same as it would be for a real
    // whole-home power sensor — one less field to keep in sync by hand.
    const totalPower = args.circuitAPower + args.circuitBPower + args.circuitCPower + args.circuitDPower
    const states: Record<string, { state: string }> = {
      "sensor.total_power": { state: String(totalPower) },
      "sensor.circuit_a_power": { state: String(args.circuitAPower) },
      "sensor.circuit_b_power": { state: String(args.circuitBPower) },
      "sensor.circuit_c_power": { state: String(args.circuitCPower) },
      "sensor.circuit_d_power": { state: String(args.circuitDPower) },
    }
    const config = {
      title: args.title,
      idle_threshold: args.idleThreshold,
      high_threshold: args.highThreshold,
      total: { entity: "sensor.total_power" },
      circuits: [
        { entity: "sensor.circuit_a_power" },
        { entity: "sensor.circuit_b_power" },
        { entity: "sensor.circuit_c_power" },
        { entity: "sensor.circuit_d_power" },
      ],
    }
    return renderCardEl("top-power-card", states, config)
  },
}

export default meta
type Story = StoryObj<Args>

export const Basic: Story = {}
