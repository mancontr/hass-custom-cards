import { buildHass, MockState } from "./mocks"

// Same Magnus-Tetens approximation as src/cards/temperature-humidity-card.ts,
// so story args don't need a separate (and easily inconsistent) dewpoint
// field — it's derived from temperature/humidity just like it would be from
// two real sensors.
export function computeDewPoint(tempC: number, rh: number): number {
  const b = 17.62, c = 243.12
  const gamma = Math.log(rh / 100) + (b * tempC) / (c + tempC)
  return (c * gamma) / (b - gamma)
}

// HA never renders a card wider than this (its column caps at 500px, minus
// the ~8px margin HA puts around cards within a column).
export const FULL_COLUMN_WIDTH = 492
// Approximates one card in a 2-up Horizontal Stack: half of a full column,
// minus half of HA's 8px inter-card gap.
export const HALF_COLUMN_WIDTH = Math.round((FULL_COLUMN_WIDTH - 8) / 2)

// Builds a real DOM tree imperatively (rather than a lit-html template) so
// every Controls change gets a fresh element with hass/setConfig applied in
// the same way Home Assistant itself does it — no reliance on lit's
// property-binding diffing picking up a card's own setConfig() side effects
// (events-card, for one, does real work in setConfig beyond `this.config =`).
function createCardShell(
  tag: string,
  states: Record<string, MockState>,
  config: Record<string, unknown>,
  extraHass: Record<string, unknown> = {},
) {
  const shell = document.createElement("div")
  shell.style.background = "var(--card-background-color)"
  shell.style.borderRadius = "12px"
  shell.style.overflow = "hidden"
  shell.style.boxShadow = "0 2px 6px rgba(0, 0, 0, 0.3)"

  const el = document.createElement(tag) as HTMLElement & {
    hass: unknown
    setConfig: (config: Record<string, unknown>) => void
  }
  el.hass = buildHass(states, extraHass)
  el.setConfig(config)

  shell.appendChild(el)
  return shell
}

// The wrapper always fills 100% of whatever space it's given, capped at
// maxWidth — exactly how HA itself sizes a card, so shrinking the Storybook
// canvas (or your actual phone) shows the card filling the screen with no
// empty margin, the same way HA never leaves gutter space next to a card.
export function renderCardEl(
  tag: string,
  states: Record<string, MockState>,
  config: Record<string, unknown>,
  maxWidth: number = FULL_COLUMN_WIDTH,
  extraHass: Record<string, unknown> = {},
) {
  const wrapper = document.createElement("div")
  wrapper.style.width = "100%"
  wrapper.style.maxWidth = `${maxWidth}px`
  wrapper.appendChild(createCardShell(tag, states, config, extraHass))
  return wrapper
}

// Renders two cards side by side inside a full-size column, the way HA's own
// Horizontal Stack actually lays them out (flex row, 8px gap, each card
// getting an equal share) — so you see both halves together instead of one
// card floating alone at half width.
export function renderHorizontalStackEl(
  tag: string,
  states: Record<string, MockState>,
  configA: Record<string, unknown>,
  configB: Record<string, unknown>,
) {
  const wrapper = document.createElement("div")
  wrapper.style.width = "100%"
  wrapper.style.maxWidth = `${FULL_COLUMN_WIDTH}px`
  wrapper.style.display = "flex"
  wrapper.style.gap = "8px"

  for (const config of [configA, configB]) {
    const shell = createCardShell(tag, states, config)
    shell.style.flex = "1 1 0"
    shell.style.minWidth = "0"
    wrapper.appendChild(shell)
  }

  return wrapper
}
