import type { Meta, StoryObj } from "@storybook/web-components-vite"
import { renderCardEl } from "../story-helpers"

interface Args {
  title: string
  watering: boolean
  activeValve: "a" | "b"
  valveADuration: number
  valveBDuration: number
}

const meta: Meta<Args> = {
  title: "Cards/Sprinklers",
  argTypes: {
    activeValve: { control: { type: "radio" }, options: ["a", "b"], if: { arg: "watering" } },
    valveADuration: { control: { type: "number", min: 0 } },
    valveBDuration: { control: { type: "number", min: 0 } },
  },
  args: {
    title: "Irrigation",
    watering: false,
    activeValve: "a",
    valveADuration: 10,
    valveBDuration: 15,
  },
  render: args => {
    const states = {
      "switch.sprinklers_main": { state: args.watering ? "on" : "off" },
      "switch.valve_a": { state: args.watering && args.activeValve === "a" ? "on" : "off" },
      "switch.valve_b": { state: args.watering && args.activeValve === "b" ? "on" : "off" },
      "number.valve_a_duration": { state: String(args.valveADuration) },
      "number.valve_b_duration": { state: String(args.valveBDuration) },
      "input_boolean.valve_a_enabled": { state: "on" },
      "input_boolean.valve_b_enabled": { state: "on" },
    }
    const config = {
      title: args.title,
      general: { switch: "switch.sprinklers_main", multi: "" },
      valves: [
        { name: "Zone A", switch: "switch.valve_a", duration: "number.valve_a_duration", enabled: "input_boolean.valve_a_enabled" },
        { name: "Zone B", switch: "switch.valve_b", duration: "number.valve_b_duration", enabled: "input_boolean.valve_b_enabled" },
      ],
    }
    return renderCardEl("sprinklers-card", states, config)
  },
}

export default meta
type Story = StoryObj<Args>

export const Idle: Story = {}
export const Watering: Story = { args: { watering: true, activeValve: "a" } }
