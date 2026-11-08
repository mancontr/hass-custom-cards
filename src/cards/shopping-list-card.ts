import { html, css, LitElement, PropertyValues } from "lit"
import L from "../intl"
import { ExtendedHomeAssistant } from "../types"

interface ShoppingListCardConfig {
  entity: string
  title?: string
  show_title?: boolean
}

type TodoStatus = "needs_action" | "completed"

interface TodoItem {
  uid: string
  summary: string
  status: TodoStatus
  description?: string | null
}

// TodoListEntityFeature.SET_DESCRIPTION_ON_ITEM in Home Assistant.
const SET_DESCRIPTION_ON_ITEM = 64

// Per device (and per list) memory of whether the completed items are
// folded away, so a phone and a desktop panel can each keep their own.
function collapsedKey(entityId: string) {
  return `shopping-list-card:collapsed:${entityId}`
}

function loadCollapsed(entityId: string): boolean {
  try {
    return localStorage.getItem(collapsedKey(entityId)) === "1"
  } catch {
    return false
  }
}

function saveCollapsed(entityId: string, collapsed: boolean) {
  try {
    if (collapsed) localStorage.setItem(collapsedKey(entityId), "1")
    else localStorage.removeItem(collapsedKey(entityId))
  } catch {
    // Storage unavailable (e.g. private mode): it just won't be remembered.
  }
}

// Max number of suggestions shown under the search box, to keep it compact
// even when typing a single letter against a long list of completed items.
const MAX_SUGGESTIONS = 8

// Case and accent insensitive, so "azucar" finds "Azúcar".
function normalize(text: string): string {
  return text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim()
}

class ShoppingListCard extends LitElement {
  config!: ShoppingListCardConfig
  hass!: ExtendedHomeAssistant
  items: TodoItem[] | null
  query: string
  editing: TodoItem | null
  editSummary: string
  editDescription: string
  completedCollapsed: boolean
  private unsubPromise?: Promise<() => void>

  static getConfigElement() {
    return document.createElement("shopping-list-card-editor")
  }

  static getStubConfig() {
    return {
      entity: "todo.shopping_list",
    }
  }

  static get properties() {
    return {
      hass: {},
      config: {},
      items: { state: true },
      query: { state: true },
      editing: { state: true },
      editSummary: { state: true },
      editDescription: { state: true },
      completedCollapsed: { state: true },
    }
  }

  constructor() {
    super()
    this.items = null
    this.query = ""
    this.editing = null
    this.editSummary = ""
    this.editDescription = ""
    this.completedCollapsed = false
  }

  setConfig(config: ShoppingListCardConfig) {
    if (!config.entity) throw new Error("You need to define a todo entity")
    if (this.config && this.config.entity !== config.entity) {
      this.unsubscribe()
      this.items = null
    }
    this.config = config
    this.completedCollapsed = loadCollapsed(config.entity)
  }

  connectedCallback() {
    super.connectedCallback()
    this.subscribe()
  }

  disconnectedCallback() {
    super.disconnectedCallback()
    this.unsubscribe()
  }

  updated(changed: PropertyValues) {
    super.updated(changed)
    this.subscribe()
  }

  L(key: string, params?: { [k: string]: string | number }): string {
    return L(this.hass, key, params)
  }

  // Live updates straight from the todo integration, so changes made from
  // any other device (or HA's own todo panel) show up immediately.
  subscribe() {
    if (this.unsubPromise || !this.isConnected || !this.hass || !this.config) return
    const entityId = this.config.entity
    this.unsubPromise = this.hass.connection.subscribeMessage<{ items: TodoItem[] }>(
      msg => { this.items = msg.items },
      { type: "todo/item/subscribe", entity_id: entityId },
    )
    this.unsubPromise.catch(err => {
      console.warn(`Shopping list: could not subscribe to ${entityId}:`, err)
      this.unsubPromise = undefined
    })
  }

  unsubscribe() {
    if (!this.unsubPromise) return
    this.unsubPromise.then(unsub => unsub()).catch(() => {})
    this.unsubPromise = undefined
  }

  get collator() {
    const lang = this.hass.locale?.language || this.hass.language
    return new Intl.Collator(lang, { sensitivity: "base", numeric: true })
  }

  sortItems(items: TodoItem[]): TodoItem[] {
    const collator = this.collator
    return [...items].sort((a, b) => collator.compare(a.summary, b.summary))
  }

  render() {
    if (!this.hass || !this.config) return html``

    const title = this.config.title || this.L("shopping.title")
    const items = this.items || []
    const pending = this.sortItems(items.filter(i => i.status !== "completed"))
    const completed = this.sortItems(items.filter(i => i.status === "completed"))

    return html`
      <ha-card>
        <div class="content">
          ${this.config.show_title !== false ? html`
            <header>
              <h1>${title}</h1>
            </header>
          ` : null}
          <div class="search">
            <div class="search-box">
              <ha-icon icon="mdi:magnify"></ha-icon>
              <input
                type="text"
                enterkeyhint="done"
                autocomplete="off"
                .value=${this.query}
                placeholder=${this.L("shopping.search")}
                @input=${this.queryChanged}
                @keydown=${this.queryKeyDown}
              />
              ${this.query ? html`
                <ha-icon class="clear" icon="mdi:close" @click=${this.clearQuery}></ha-icon>
              ` : null}
            </div>
            ${this.query.trim() ? this.renderSuggestions(items, completed) : null}
          </div>
          <main>
            ${this.items && !items.length ? html`
              <div class="empty">${this.L("shopping.empty")}</div>
            ` : null}
            ${pending.map(item => this.renderItem(item))}
            ${completed.length ? html`
              <div class="section-title" role="button" @click=${this.toggleCompleted}>
                <span>${this.L("shopping.completed")} · ${completed.length}</span>
                <ha-icon icon=${this.completedCollapsed ? "mdi:chevron-down" : "mdi:chevron-up"}></ha-icon>
              </div>
            ` : null}
            ${this.completedCollapsed ? null : completed.map(item => this.renderItem(item))}
          </main>
        </div>
        ${this.editing ? this.renderEditor() : null}
      </ha-card>
    `
  }

  // Completed items matching the query, ready to be marked as pending again.
  // Items starting with the query go first, then the ones containing it.
  getMatches(completed: TodoItem[]): TodoItem[] {
    const q = normalize(this.query)
    const starts: TodoItem[] = []
    const contains: TodoItem[] = []
    for (const item of completed) {
      const name = normalize(item.summary)
      if (name.startsWith(q)) starts.push(item)
      else if (name.includes(q)) contains.push(item)
    }
    return [...starts, ...contains].slice(0, MAX_SUGGESTIONS)
  }

  renderSuggestions(items: TodoItem[], completed: TodoItem[]) {
    const q = normalize(this.query)
    const matches = this.getMatches(completed)
    const exact = items.find(i => normalize(i.summary) === q)
    const alreadyPending = exact && exact.status !== "completed"

    return html`
      <div class="suggestions">
        ${matches.map(item => html`
          <div class="suggestion" @click=${() => this.markPending(item)}>
            <ha-icon icon="mdi:cart-plus"></ha-icon>
            <span class="summary">${item.summary}</span>
            ${item.description ? html`
              <span class="description">${item.description}</span>
            ` : null}
          </div>
        `)}
        ${alreadyPending ? html`
          <div class="suggestion disabled">
            <ha-icon icon="mdi:check"></ha-icon>
            <span>${this.L("shopping.already-pending", { name: exact.summary })}</span>
          </div>
        ` : null}
        ${!exact ? html`
          <div class="suggestion add" @click=${this.addItem}>
            <ha-icon icon="mdi:plus"></ha-icon>
            <span>${this.L("shopping.add", { name: this.query.trim() })}</span>
          </div>
        ` : null}
      </div>
    `
  }

  renderItem(item: TodoItem) {
    const done = item.status === "completed"
    return html`
      <div class="item ${done ? "completed" : "pending"}" @click=${() => this.toggleItem(item)}>
        <ha-icon icon=${done ? "mdi:checkbox-marked" : "mdi:checkbox-blank-outline"}></ha-icon>
        <div class="text">
          <div class="summary">${item.summary}</div>
          ${item.description ? html`
            <div class="description">${item.description}</div>
          ` : null}
        </div>
        <ha-icon class="edit" icon="mdi:pencil-outline" @click=${(ev: Event) => this.openEditor(ev, item)}></ha-icon>
      </div>
    `
  }

  get supportsDescription() {
    const features = Number(this.hass.states[this.config.entity]?.attributes?.supported_features) || 0
    return (features & SET_DESCRIPTION_ON_ITEM) !== 0
  }

  renderEditor() {
    return html`
      <ha-dialog open hideActions .heading=${this.L("shopping.edit")} @closed=${this.closeEditor}>
        <div class="editor">
          <label>
            <span>${this.L("shopping.name")}</span>
            <input
              type="text"
              autocomplete="off"
              .value=${this.editSummary}
              @input=${(ev: InputEvent) => { this.editSummary = (ev.target as HTMLInputElement).value }}
              @keydown=${(ev: KeyboardEvent) => { if (ev.key === "Enter") this.saveEditor() }}
            />
          </label>
          ${this.supportsDescription ? html`
            <label>
              <span>${this.L("shopping.description")}</span>
              <textarea
                rows="3"
                .value=${this.editDescription}
                @input=${(ev: InputEvent) => { this.editDescription = (ev.target as HTMLTextAreaElement).value }}
              ></textarea>
            </label>
          ` : null}
          <div class="actions">
            <button class="delete" @click=${this.deleteEditing}>${this.L("shopping.delete")}</button>
            <button class="save" ?disabled=${!this.editSummary.trim()} @click=${this.saveEditor}>
              ${this.L("shopping.save")}
            </button>
          </div>
        </div>
      </ha-dialog>
    `
  }

  toggleCompleted() {
    this.completedCollapsed = !this.completedCollapsed
    saveCollapsed(this.config.entity, this.completedCollapsed)
  }

  openEditor(ev: Event, item: TodoItem) {
    ev.stopPropagation()
    this.editing = item
    this.editSummary = item.summary
    this.editDescription = item.description || ""
  }

  closeEditor() {
    this.editing = null
  }

  // Only sends the fields that actually changed. An emptied description is
  // sent as null, which is how HA clears it.
  saveEditor() {
    const item = this.editing
    const summary = this.editSummary.trim()
    if (!item || !summary) return
    const data: Record<string, unknown> = {}
    if (summary !== item.summary) data.rename = summary
    const description = this.editDescription.trim()
    if (this.supportsDescription && description !== (item.description || "")) {
      data.description = description || null
    }
    if (Object.keys(data).length) {
      this.hass.callService("todo", "update_item", {
        entity_id: this.config.entity,
        item: item.uid,
        ...data,
      })
    }
    this.closeEditor()
  }

  deleteEditing() {
    const item = this.editing
    if (!item) return
    this.hass.callService("todo", "remove_item", {
      entity_id: this.config.entity,
      item: item.uid,
    })
    this.closeEditor()
  }

  queryChanged(ev: InputEvent) {
    this.query = (ev.target as HTMLInputElement).value
  }

  // Enter picks the first suggestion (a matching completed item, or adding
  // the typed text when there's none), Escape clears the box.
  queryKeyDown(ev: KeyboardEvent) {
    if (ev.key === "Escape") {
      this.clearQuery()
    } else if (ev.key === "Enter" && this.query.trim()) {
      const items = this.items || []
      const q = normalize(this.query)
      const exact = items.find(i => normalize(i.summary) === q)
      const [first] = this.getMatches(items.filter(i => i.status === "completed"))
      if (exact) {
        if (exact.status === "completed") this.markPending(exact)
        else this.clearQuery()
      } else if (first) {
        this.markPending(first)
      } else {
        this.addItem()
      }
    }
  }

  clearQuery() {
    this.query = ""
    this.shadowRoot?.querySelector("input")?.focus()
  }

  setStatus(item: TodoItem, status: TodoStatus) {
    return this.hass.callService("todo", "update_item", {
      entity_id: this.config.entity,
      item: item.uid,
      status,
    })
  }

  toggleItem(item: TodoItem) {
    this.setStatus(item, item.status === "completed" ? "needs_action" : "completed")
  }

  markPending(item: TodoItem) {
    this.setStatus(item, "needs_action")
    this.clearQuery()
  }

  addItem() {
    const summary = this.query.trim()
    if (!summary) return
    this.hass.callService("todo", "add_item", {
      entity_id: this.config.entity,
      item: summary,
    })
    this.clearQuery()
  }

  static get styles() {
    return css`
      ha-card {
        color: var(--primary-text-color,inherit);
      }
      /* Keeps the content readable on very wide cards (e.g. a panel view),
         where the edit icons would end up far away from their items. */
      .content {
        max-width: 700px;
        margin: 0 auto;
      }
      header {
        padding: 22px 16px 0;
      }
      h1 {
        color: var(--ha-card-header-color,--primary-text-color);
        font-family: var(--ha-card-header-font-family,inherit);
        font-size: var(--ha-card-header-font-size,24px);
        letter-spacing: -0.012em;
        line-height: 24px;
        font-weight: 400;
        margin: 0;
      }
      /* Stays in view while scrolling down a long list. HA's toolbar is fixed
         on top of the scrolling page, hence the offset. */
      .search {
        position: sticky;
        top: calc(var(--header-height, 56px) + var(--safe-area-inset-top, 0px));
        z-index: 1;
        background: var(--ha-card-background, var(--card-background-color, white));
        padding: 16px 16px 8px;
      }
      .search-box {
        display: flex;
        align-items: center;
        background-color: var(--secondary-background-color);
        border-radius: 8px;
        padding: 0 8px;
        color: var(--secondary-text-color);
        --mdc-icon-size: 20px;
      }
      .search-box input {
        flex: 1 1 auto;
        min-width: 0;
        background: none;
        border: none;
        outline: none;
        color: var(--primary-text-color);
        font: inherit;
        font-size: 16px; /* Avoids iOS zooming in on focus */
        padding: 10px 8px;
      }
      .search-box input::placeholder {
        color: var(--secondary-text-color);
      }
      .search-box .clear {
        cursor: pointer;
      }
      .suggestions {
        border: 1px solid var(--divider-color);
        border-radius: 8px;
        margin-top: 4px;
        overflow: hidden;
      }
      .suggestion {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 8px 12px;
        cursor: pointer;
        color: var(--primary-color);
        --mdc-icon-size: 20px;
      }
      .suggestion + .suggestion {
        border-top: 1px solid var(--divider-color);
      }
      .suggestion:hover {
        background-color: var(--secondary-background-color);
      }
      .suggestion.disabled {
        cursor: default;
        color: var(--secondary-text-color);
      }
      .suggestion.disabled:hover {
        background: none;
      }
      main {
        padding: 0 16px 16px;
      }
      .item {
        display: flex;
        align-items: center;
        gap: 12px;
        /* Bleeds into main's padding so the hover background has some room
           around the content, while keeping it aligned with the rest. */
        padding: 6px 8px;
        margin: 0 -8px;
        border-radius: 8px;
        cursor: pointer;
        --mdc-icon-size: 22px;
      }
      /* Only on devices with a real pointer: on touch screens :hover sticks
         to the last tapped row. Mostly useful on wide cards (e.g. a panel
         view), where the edit icon is far from the item's name. */
      @media (hover: hover) {
        .item:hover {
          background-color: var(--secondary-background-color);
        }
        .item:hover .edit {
          color: var(--secondary-text-color);
        }
      }
      .item ha-icon {
        color: var(--paper-item-icon-color);
      }
      .item.completed {
        color: var(--secondary-text-color);
      }
      .item.completed ha-icon {
        color: var(--disabled-text-color);
      }
      .item .text {
        flex: 1 1 auto;
        min-width: 0;
      }
      .summary, .description {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .description {
        color: var(--secondary-text-color);
        font-size: 12px;
      }
      .item.completed .description {
        color: var(--disabled-text-color);
      }
      .item .edit {
        color: var(--disabled-text-color);
        padding: 4px;
        margin: -4px;
        --mdc-icon-size: 18px;
      }
      .item .edit:hover {
        color: var(--primary-text-color);
      }
      .suggestion .summary {
        flex: 0 0 auto;
        max-width: 60%;
      }
      .suggestion .description {
        flex: 0 1 auto;
        min-width: 0;
        margin-left: -4px;
      }
      .editor {
        display: flex;
        flex-direction: column;
        gap: 16px;
        min-width: min(360px, 80vw);
      }
      .editor label {
        display: flex;
        flex-direction: column;
        gap: 4px;
        color: var(--secondary-text-color);
        font-size: 12px;
      }
      .editor input, .editor textarea {
        background-color: var(--secondary-background-color);
        border: none;
        border-radius: 8px;
        color: var(--primary-text-color);
        font: inherit;
        font-size: 16px;
        padding: 10px 12px;
        outline: none;
        resize: vertical;
      }
      .editor .actions {
        display: flex;
        justify-content: space-between;
      }
      .editor button {
        background: none;
        border: none;
        border-radius: 8px;
        cursor: pointer;
        font: inherit;
        font-weight: 500;
        padding: 8px 12px;
      }
      .editor .delete {
        color: var(--error-color, #db4437);
      }
      .editor .save {
        background-color: var(--primary-color);
        color: var(--text-primary-color, #fff);
      }
      .editor .save:disabled {
        opacity: 0.5;
        cursor: default;
      }
      .section-title {
        display: flex;
        align-items: center;
        justify-content: space-between;
        border-top: 1px solid var(--divider-color);
        color: var(--secondary-text-color);
        cursor: pointer;
        font-size: 12px;
        font-weight: 500;
        margin-top: 8px;
        padding: 8px 0 4px;
        text-transform: uppercase;
        --mdc-icon-size: 20px;
      }
      .section-title ha-icon {
        /* Lines up with the edit icons on the items below. */
        margin-right: -1px;
      }
      @media (hover: hover) {
        .section-title:hover {
          color: var(--primary-text-color);
        }
      }
      main > .section-title:first-child {
        border-top: none;
        margin-top: 0;
      }
      .empty {
        color: var(--secondary-text-color);
        padding: 8px 0;
      }
    `
  }

}

customElements.define("shopping-list-card", ShoppingListCard)
