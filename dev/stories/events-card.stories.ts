import type { Meta, StoryObj } from "@storybook/web-components-vite"
import { renderCardEl } from "../story-helpers"

interface Args {
  title: string
  entityAName: string
  entityBName: string
}

// A custom history response (rather than the generic one in dev/mocks.ts)
// so we can exercise events-card's grouping: 3 "on" events for the same
// entity within its 5-minute (300s) grouping window, plus one far-away event
// on that same entity that should stay ungrouped, and a second entity with
// simple spaced-out events for contrast. Timestamps are laid out so the
// grouped row lands in the middle of the list, not at either end.
function historyWithGrouping() {
  const now = Date.now() / 1000
  const on = (secondsAgo: number) => ({ s: "on", lu: now - secondsAgo })
  const off = (secondsAgo: number) => ({ s: "off", lu: now - secondsAgo })

  return {
    "binary_sensor.entry_a": [
      on(4 * 3600), off(4 * 3600 - 10),
      on(4 * 3600 + 120), off(4 * 3600 + 110),
      on(4 * 3600 + 240), off(4 * 3600 + 230),
      on(8 * 3600), off(8 * 3600 - 20),
    ],
    "binary_sensor.motion_a": [
      on(1 * 3600), off(1 * 3600 - 20),
      on(12 * 3600), off(12 * 3600 - 20),
    ],
  }
}

const meta: Meta<Args> = {
  title: "Cards/Events",
  args: {
    title: "Activity",
    entityAName: "Entry A",
    entityBName: "Motion A",
  },
  render: args => {
    const states = {
      "binary_sensor.entry_a": { state: "off" },
      "binary_sensor.motion_a": { state: "off" },
    }
    const config = {
      title: args.title,
      entities: [
        { entity: "binary_sensor.entry_a", name: args.entityAName, icon: "mdi:door", group: "entry_a" },
        { entity: "binary_sensor.motion_a", name: args.entityBName, icon: "mdi:motion-sensor" },
      ],
    }
    const callWS = () => Promise.resolve(historyWithGrouping())
    return renderCardEl("events-card", states, config, undefined, { callWS })
  },
}

export default meta
type Story = StoryObj<Args>

// Entry A shows 3 close-together events collapsed into one row ("+2 more"),
// plus a separate older event that's far enough away to stay ungrouped.
export const Basic: Story = {}
