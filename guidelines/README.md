# CLI UX Guidelines

Written guidance, principles, and patterns for designing good command-line UX.

## How this is organized

- Start with high-level **principles**, then add focused **pattern** docs as they emerge
  (prompts, confirmations, non-interactive/agent-friendly flags, error messaging, etc.).
- Keep each guideline practical, with concrete CLI output examples.

## Contents

<!-- Add links to guideline docs as they are created -->

- _No guidelines written yet._

## Principles (starter set)

1. **Design for both humans and agents.** Every interactive prompt should have a
   non-interactive equivalent (flag or env var) so automation never gets stuck on a TTY.
2. **Make state and consequences explicit.** Surface stable identifiers and clear
   reasons ("required by `azure.yaml`") rather than vague warnings.
3. **Consent gates, refinement follows.** Ask *whether* before *how/where*.
4. **Stable, greppable output.** Predictable structure and identifiers make output
   parseable by tools and agents.
5. **Sensible defaults, easy overrides.** Optimize the common path to one keystroke;
   let power users and agents override.
