import type { Meta, StoryObj } from "@storybook/web-components-vite"
import { renderCardEl, FULL_COLUMN_WIDTH } from "../story-helpers"

interface Args {
  title: string
  showTitle: boolean
  panel: boolean
  completedCollapsed: boolean
  language: "en" | "es"
  pending: string
  completed: string
  search: string
}

interface TodoItem {
  uid: string
  summary: string
  status: "needs_action" | "completed"
  description?: string | null
}

const ENTITY = "todo.shopping_list"

// What HA's Shopping List integration reports: create, delete, update and
// move items, plus SET_DESCRIPTION_ON_ITEM (64), which the edit dialog checks.
const SUPPORTED_FEATURES = 1 | 2 | 4 | 8 | 64

function parseList(text: string): string[] {
  return text.split(",").map(s => s.trim()).filter(Boolean)
}

// Each entry is "Name" or "Name: description".
function parseItem(text: string): { summary: string, description?: string } {
  const [summary, ...rest] = text.split(":")
  const description = rest.join(":").trim()
  return { summary: summary.trim(), description: description || undefined }
}

// A tiny in-memory todo list standing in for HA's todo integration: it
// answers "todo/item/subscribe" and the todo.add_item / update_item /
// remove_item services, pushing the new list to subscribers after every change - so the
// card is fully interactive here, the same way it is against a real instance.
function mockTodo(pending: string[], completed: string[]) {
  let nextUid = 1
  const make = (text: string, status: TodoItem["status"]): TodoItem => ({ uid: String(nextUid++), status, ...parseItem(text) })
  let items: TodoItem[] = [
    ...pending.map(s => make(s, "needs_action")),
    ...completed.map(s => make(s, "completed")),
  ]
  const listeners = new Set<(msg: { items: TodoItem[] }) => void>()
  const notify = () => listeners.forEach(cb => cb({ items: [...items] }))

  const connection = {
    subscribeMessage: (cb: (msg: { items: TodoItem[] }) => void, msg: { type: string }) => {
      if (msg.type !== "todo/item/subscribe") return Promise.reject(new Error(`Unmocked ${msg.type}`))
      listeners.add(cb)
      // Real HA sends the current list right away after subscribing.
      setTimeout(() => cb({ items: [...items] }))
      return Promise.resolve(() => { listeners.delete(cb) })
    },
  }

  const callService = (domain: string, service: string, data: Record<string, string | null>) => {
    // eslint-disable-next-line no-console
    console.log("[dev] callService", domain, service, data)
    if (domain === "todo" && service === "add_item") {
      items = [...items, { uid: String(nextUid++), summary: String(data.item), status: "needs_action" }]
    } else if (domain === "todo" && service === "update_item") {
      items = items.map(i => i.uid !== data.item ? i : {
        ...i,
        ...(data.status ? { status: data.status as TodoItem["status"] } : {}),
        ...(data.rename ? { summary: data.rename } : {}),
        ...("description" in data ? { description: data.description } : {}),
      })
    } else if (domain === "todo" && service === "remove_item") {
      items = items.filter(i => i.uid !== data.item)
    }
    setTimeout(notify)
    return Promise.resolve()
  }

  return { connection, callService }
}

const meta: Meta<Args> = {
  title: "Cards/Shopping List",
  argTypes: {
    completedCollapsed: { control: "boolean", description: "Whether the completed section starts folded (the card remembers it per device in localStorage; this overrides it on every render)" },
    panel: { control: "boolean", description: "Fill the whole canvas, like the only card in a panel view, instead of HA's usual column width" },
    language: { control: { type: "radio" }, options: ["en", "es"] },
    pending: { control: "text", description: "Comma separated pending items, as \"Name\" or \"Name: description\" (in any order, the card sorts them)" },
    completed: { control: "text", description: "Comma separated completed items, same format as pending" },
    search: { control: "text", description: "Initial text in the search box" },
  },
  args: {
    title: "",
    showTitle: true,
    panel: false,
    completedCollapsed: false,
    language: "en",
    pending: "Milk: lactose-free (2 cartons), Bread, Eggs, Apples: Golden or Fuji",
    completed: "Rice, Butter, Coffee: ground decaf, Lettuce, Lemons: organic, Olive oil, Tomatoes, Yogurt, Bananas, Pickles: the small jar",
    search: "",
  },
  render: args => {
    const states = {
      [ENTITY]: { state: String(parseList(args.pending).length), attributes: { supported_features: SUPPORTED_FEATURES } },
    }
    const config = {
      entity: ENTITY,
      title: args.title || undefined,
      show_title: args.showTitle,
    }
    const extraHass = {
      language: args.language,
      selectedLanguage: args.language,
      ...mockTodo(parseList(args.pending), parseList(args.completed)),
    }
    // The card reads this on setConfig; set it first so every render starts
    // from the arg, not from whatever was left over from a previous story.
    const collapsedKey = `shopping-list-card:collapsed:${ENTITY}`
    if (args.completedCollapsed) localStorage.setItem(collapsedKey, "1")
    else localStorage.removeItem(collapsedKey)
    const maxWidth = args.panel ? Number.MAX_SAFE_INTEGER : FULL_COLUMN_WIDTH
    const wrapper = renderCardEl("shopping-list-card", states, config, maxWidth, extraHass)
    const card = wrapper.querySelector("shopping-list-card") as HTMLElement & { query: string }
    card.query = args.search
    return wrapper
  },
}

export default meta
type Story = StoryObj<Args>

// Click any item to toggle it, or type in the box to find a completed item
// (or add a new one) - all changes are kept until the story re-renders.
export const Basic: Story = {}

// Typing "le" finds both completed items starting with it (Lemons, Lettuce)
// and the ones containing it (Pickles), plus the option to add it as-is.
export const Searching: Story = { args: { search: "le" } }

// When the typed text matches an item already pending, there's nothing to
// add or re-mark, so the card just says so.
export const AlreadyPending: Story = { args: { search: "milk" } }

export const Spanish: Story = {
  args: {
    language: "es",
    pending: "Leche: sin lactosa, Pan, Huevos, Azúcar",
    completed: "Arroz, Mantequilla, Café: molido descafeinado, Lechuga, Limones, Aceite, Tomates: Mercadona, Yogur, Plátanos",
    search: "",
  },
}

// Without the title, e.g. for a panel view, where HA already shows the
// view's name right above the card.
export const NoTitle: Story = { args: { showTitle: false } }

// As the only card of a panel view: the content keeps a readable width,
// centered, instead of stretching across the whole screen.
export const Panel: Story = { args: { showTitle: false, panel: true } }

// Completed items folded away: still reachable from the search box, with
// their count in the section header.
export const CompletedCollapsed: Story = { args: { completedCollapsed: true } }

export const Empty: Story = { args: { pending: "", completed: "" } }
