import type { Preview } from "@storybook/web-components-vite"
import { html } from "lit"
import "../src/index"
import { installMocks } from "../dev/mocks"
import "@fontsource/roboto/300.css"
import "@fontsource/roboto/400.css"
import "@fontsource/roboto/500.css"
import "@fontsource/roboto/700.css"

installMocks()

// Covers every var(--...) actually referenced across src/cards/*.ts (checked
// via grep) — a card silently loses its color instead of erroring when a var
// it needs isn't defined here, so this list should stay exhaustive.
const THEMES: Record<string, Record<string, string>> = {
  dark: {
    "--primary-background-color": "#111111",
    "--card-background-color": "#1c1c1c",
    "--secondary-background-color": "#2a2a2a",
    "--primary-text-color": "#e1e1e1",
    "--secondary-text-color": "#9b9b9b",
    "--disabled-text-color": "#6f6f6f",
    "--divider-color": "#333",
    "--primary-color": "#58a6ff",
    "--ha-card-border-color": "rgba(255, 255, 255, 0.12)",
    "--paper-item-icon-color": "#a1a1a1",
    "--scrollbar-thumb-color": "#555",
    "--ha-card-header-color": "#e1e1e1",
    "--state-active-color": "#fdd835",
    "--state-inactive-color": "#6f6f6f",
    "--state-switch-active-color": "#fdd835",
    "--state-switch-inactive-color": "#6f6f6f",
    "--state-switch-on-color": "#fdd835",
    "--state-switch-off-color": "#6f6f6f",
    "--state-unavailable-color": "#6f6f6f",
  },
  light: {
    "--primary-background-color": "#fafafa",
    "--card-background-color": "#ffffff",
    "--secondary-background-color": "#f0f0f0",
    "--primary-text-color": "#1c1c1c",
    "--secondary-text-color": "#6a6a6a",
    "--disabled-text-color": "#b0b0b0",
    "--divider-color": "#e0e0e0",
    "--primary-color": "#1a73e8",
    "--ha-card-border-color": "rgba(0, 0, 0, 0.12)",
    "--paper-item-icon-color": "#44739e",
    "--scrollbar-thumb-color": "#ccc",
    "--ha-card-header-color": "#1c1c1c",
    "--state-active-color": "#fdd835",
    "--state-inactive-color": "#b0b0b0",
    "--state-switch-active-color": "#fdd835",
    "--state-switch-inactive-color": "#b0b0b0",
    "--state-switch-on-color": "#fdd835",
    "--state-switch-off-color": "#b0b0b0",
    "--state-unavailable-color": "#b0b0b0",
  },
}

// Applied to the document root (not just a wrapping div) so the background
// covers the whole preview canvas — otherwise Storybook's default white
// iframe background shows through as a gutter around a dark-themed card.
function applyTheme(theme: string) {
  const vars = THEMES[theme] || THEMES.dark
  const root = document.documentElement
  for (const [key, value] of Object.entries(vars)) {
    root.style.setProperty(key, value)
  }
  document.body.style.margin = "0"
  document.body.style.background = vars["--primary-background-color"]
}

const preview: Preview = {
  globalTypes: {
    theme: {
      description: "Home Assistant theme",
      toolbar: {
        title: "Theme",
        icon: "mirror",
        items: [
          { value: "dark", title: "Dark" },
          { value: "light", title: "Light" },
        ],
        dynamicTitle: true,
      },
    },
  },
  initialGlobals: {
    theme: "dark",
  },
  decorators: [
    (story, context) => {
      applyTheme(context.globals.theme as string)
      return html`<div style="padding:16px;">${story()}</div>`
    },
  ],
}

export default preview
