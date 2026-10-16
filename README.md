# cliux

A home for **CLI UX** work: interactive prototypes, reusable design-review UI elements, and CLI UX guidelines.

The site is published with **GitHub Pages** so anything under this repo can be deployed and shared with engineers as a link.

🔗 **Live site:** https://hyoshis.github.io/cliux/

## What lives here

| Folder | Purpose |
| --- | --- |
| [`prototypes/`](./prototypes) | Self-contained, deployable prototypes. Each gets its own shareable URL. |
| [`components/`](./components) | Reusable design-review UI elements (e.g. clickable *Next* buttons, design-decision callouts) used to build and annotate prototypes. |
| [`guidelines/`](./guidelines) | Written CLI UX guidelines, principles, and patterns. |
| [`assets/`](./assets) | Shared CSS, JS, and images used across prototypes and components. |

## Sharing a prototype

Each prototype is a static folder. Once pushed to `main`, it is live at:

```
https://hyoshis.github.io/cliux/prototypes/<prototype-name>/
```

Send that link to engineers — no build step, no local setup required.

## Adding a new prototype

1. Copy an existing folder in `prototypes/` (or start from scratch).
2. Keep it self-contained: an `index.html` plus any local assets, or reference shared files from `/assets`.
3. Add a short entry to [`prototypes/README.md`](./prototypes/README.md) and, for CLI UX prototypes, a prototype card on the landing [`index.html`](./index.html). Include its product in `data-categories` (`azd` or `foundry`; space-separated for multiple products) and useful commands or synonyms in `data-keywords`. The homepage search, filters, and counts use these cards automatically; the initial counts in the HTML should also match the collection.
4. Commit and push to `main`. It goes live automatically.

## Enabling GitHub Pages (one-time)

Repo **Settings → Pages → Build and deployment**:
- **Source:** Deploy from a branch
- **Branch:** `main` / `/ (root)`

The landing page (`index.html`) then serves at the live site URL above and links to the CLI UX prototype collection.

## Prototype directory

The homepage is a searchable collection of Azure Developer CLI and Foundry UX prototypes, with product filters, illustrative terminal previews, and direct links to each prototype's deployed GitHub Pages URL, including when previewing the homepage locally. Research decks remain published at their own URLs but are not included in the homepage collection. Search matches titles, descriptions, tags, commands, and folder names. Press `/` to focus search and `Escape` to clear it. All listed prototype links remain available without JavaScript.

Each card shows **Last published** using the UTC completion date of the first successful GitHub Pages build containing that prototype's latest folder change. After publishing a prototype update, refresh its card's `<time datetime="...">`, visible date, and tooltip from the Pages build history. These dates are static metadata, not local file timestamps or runtime GitHub API requests.

Homepage-only styles and behavior live in `assets/css/home.css` and `assets/js/home.js`; the shared `site.css` used by other pages is unchanged.

## Local preview

No build required — it's static. To preview locally:

```bash
# from the repo root
python -m http.server 8000
# then open http://localhost:8000
```

## Conventions

- **Static only.** Everything must run as plain static files so GitHub Pages can host it.
- **Self-contained prototypes.** A prototype should work when opened on its own.
- **Shared > duplicated.** Put anything reused across prototypes in `components/` or `assets/`.
