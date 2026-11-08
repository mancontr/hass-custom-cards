# Hass Custom Cards

Lit-based Home Assistant cards, bundled into one file. Everything in the repo (code, comments, docs, stories) is in English.

## Adding a card

1. `src/cards/<name>-card.ts`, following the existing cards' structure.
2. Import it in `src/index.ts` (alphabetical).
3. Strings in both `src/intl/en.json` and `es.json`, under a per-card key prefix.
4. `docs/<name>-card.md` (options table + usage) and a `docs/<name>-card.png` screenshot.
5. Link it in the README's card list (alphabetical).
6. Stories in `dev/stories/<name>-card.stories.ts`, with editable Controls for the interesting values.
7. Visual editor via `static getConfigForm()` (helpers in `src/editor.ts`, labels under `<prefix>.editor.*`), plus a `getStubConfig()` that picks real entities, and `registerCard()` after `customElements.define` so it shows up in the card picker. Cards must render a half-filled config without throwing.

## Conventions

- Every CSS var a card uses must be in both themes in `.storybook/preview.ts`, or it silently loses its color there.
- Story sample data must look tidy: consistent capitalization, realistic values.
- Doc screenshots: dark theme, real card width (492px, the default story wrapper), 1x scale.

## Checks

`yarn lint` and `yarn build`. Check visual changes in Storybook (`yarn storybook`).
