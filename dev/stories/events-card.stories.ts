import type { Meta, StoryObj } from "@storybook/web-components-vite"
import { renderCardEl } from "../story-helpers"

interface Args {
  title: string
}

// A custom history response (rather than the generic one in dev/mocks.ts) so
// we can exercise events-card's grouping with a small, realistic day in the
// life of the house - all 5 entities share the same "entryway" group, and
// the story naturally falls into separate rows purely from the time gaps
// between events (no need for a second group config):
// - Yesterday 8 PM: leaving, garage door alone.
// - Just after midnight: arriving back home - garage door, garage camera,
//   front door, ~20-30s apart -> collapses to "and 2 more".
// - ~30 min later: heading to bed - stairs, then hallway, ~20s apart ->
//   collapses to "and 1 more".
// - This morning: leaving again, simplified to just the garage camera,
//   alone.
// All offsets are anchored to a fixed hour rather than `Date.now()`, so the
// rendered times - and which events fall on "today" vs "yesterday" - don't
// drift depending on what time of day this story happens to be loaded.
function historyWithGrouping() {
  const anchor = new Date()
  anchor.setHours(9, 0, 0, 0)
  const now = anchor.getTime() / 1000
  const on = (secondsAgo: number) => ({ s: "on", lu: now - secondsAgo })
  const off = (secondsAgo: number) => ({ s: "off", lu: now - secondsAgo })

  return {
    "binary_sensor.garage_door": [
      // Leaving the previous evening, alone
      on(13 * 3600), off(13 * 3600 - 10),
      // Arriving back home just after midnight - oldest member of the cluster
      on(8 * 3600 + 50 * 60), off(8 * 3600 + 50 * 60 - 10),
    ],
    "binary_sensor.garage_camera": [
      // Same cluster, ~20s after the garage door
      on(8 * 3600 + 49 * 60 + 40), off(8 * 3600 + 49 * 60 + 30),
      // Leaving again the next morning, alone (simplified to just this sensor)
      on(1 * 3600), off(1 * 3600 - 10),
    ],
    "binary_sensor.front_door": [
      // Same cluster, newest member -> becomes the group head
      on(8 * 3600 + 49 * 60 + 10), off(8 * 3600 + 49 * 60),
    ],
    "binary_sensor.stairs": [
      // Heading to bed ~30 min later, oldest member of this cluster
      on(8 * 3600 + 20 * 60), off(8 * 3600 + 20 * 60 - 10),
    ],
    "binary_sensor.hallway": [
      // Same cluster, newest member -> becomes the group head
      on(8 * 3600 + 19 * 60 + 40), off(8 * 3600 + 19 * 60 + 30),
    ],
  }
}

const meta: Meta<Args> = {
  title: "Cards/Events",
  args: {
    title: "Activity",
  },
  render: args => {
    const states = {
      "binary_sensor.garage_door": { state: "off" },
      "binary_sensor.garage_camera": { state: "off" },
      "binary_sensor.front_door": { state: "off" },
      "binary_sensor.stairs": { state: "off" },
      "binary_sensor.hallway": { state: "off" },
    }
    const config = {
      title: args.title,
      entities: [
        { entity: "binary_sensor.garage_door", name: "Garage door", icon: "mdi:garage", group: "entryway" },
        { entity: "binary_sensor.garage_camera", name: "Garage camera", icon: "mdi:cctv", group: "entryway" },
        { entity: "binary_sensor.front_door", name: "Front door", icon: "mdi:door", group: "entryway" },
        { entity: "binary_sensor.stairs", name: "Stairs", group: "entryway" },
        { entity: "binary_sensor.hallway", name: "Hallway", group: "entryway" },
      ],
    }
    const callWS = () => Promise.resolve(historyWithGrouping())
    return renderCardEl("events-card", states, config, undefined, { callWS })
  },
}

export default meta
type Story = StoryObj<Args>

// A day in the life of the house: leaving, coming back and walking through
// it, then heading out again - each burst of nearby sensors collapses into
// its own row, and the standalone events crossing into the previous day
// exercise the day header.
export const Basic: Story = {}
