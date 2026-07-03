# Frontend Structure

This frontend is intentionally static and framework-free for now, but its source layout follows the same responsibility split used by OpenList-Frontend:

- `app/`: application shell behavior and app-level styles.
- `components/`: reusable UI helpers that are not tied to a single page.
- `pages/`: page or panel specific runtime code.
- `store/`: small state factories and persistence helpers.
- `assets/`: copied local assets and fixed runtime resources.

The Codex panel lives under `pages/codex/`:

- `index.js`: panel bootstrap and event coordination.
- `config.js`: Shadow DOM mount and static resource list.
- `api.js`: controller API calls and response normalization.
- `fixtures.js`: static fallback data used before real sessions are wired.
- `renderer.js`: current static DOM renderer for the copied Codex panel shape.
- `utils.js`: formatting, escaping, time, and activity helpers.
- `panel.css`: host-page adapter styles.
- `panel-shadow.css`: Shadow DOM adapter styles.

Shared Codex panel state lives in `store/codex.js`. Keep browser persistence and reusable state defaults there rather than in the page bootstrap.

Copied ChatGPT/Codex extension CSS under `assets/chatgpt/` must remain byte-for-byte aligned with the captured official assets unless the source-alignment audit is updated with an explicit adapter rule.
