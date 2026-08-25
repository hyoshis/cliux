# Prototypes

Self-contained, deployable CLI UX prototypes. Each prototype is a static folder that runs on its own and is published via GitHub Pages.

## Live URL pattern

```
https://hyoshis.github.io/cliux/prototypes/<prototype-name>/
```

## Guidelines

- Each prototype lives in its own folder with an `index.html` entry point.
- Keep it **self-contained** — it should work when opened directly.
- Reuse shared styles/scripts from [`/assets`](../assets) or elements from [`/components`](../components) where it helps, but don't break standalone use.
- Prefer plain static HTML/CSS/JS (no build step) so Pages can host it as-is.

## Index

<!-- Add one row per prototype -->

| Prototype | Description | Link |
| --- | --- | --- |
| **azd · Extension auto-install** | Interactive terminal prototype of the `azd up` extension-install UX (single/multiple extensions, source selection). | [`azd-extension-install/`](./azd-extension-install/) · [live](https://hyoshis.github.io/cliux/prototypes/azd-extension-install/) |
| **Foundry DevPack · Install redesign** | Interactive comparison of a one-step install and a guided flow for choosing which Foundry tools to install. | [`foundry-devpack/`](./foundry-devpack/) · [live](https://hyoshis.github.io/cliux/prototypes/foundry-devpack/) |
| **Agentic CLI competitive analysis** | Interactive slide deck comparing AI CLI products, interaction patterns, visual systems, and product positioning. | [`agentic-cli-analysis/`](./agentic-cli-analysis/) · [live](https://hyoshis.github.io/cliux/prototypes/agentic-cli-analysis/) |
| **azd · Validation warning** | Side-by-side tabbed prototype for comparing the current validation warning with revised messaging. | [`validation-warning/`](./validation-warning/) · [live](https://hyoshis.github.io/cliux/prototypes/validation-warning/) |
