# Reset 30 Invalid Default Anchor Probe

Archived on 2026-07-07.

This capture was produced after Reset 30, but it is not valid acceptance
evidence. It used the script's default short/repeated anchors:

- `./build-all.sh`
- `systemctl restart codex-web.service`
- `GET /`
- `GET /api/nodes`

The run found both source and target Codex conversation contexts, but multiple
anchors matched different surrounding context between source and target. The
run failed 5 checks and cannot close any visual parity task.

Use this directory only as a tooling clue. Fresh active evidence must use exact,
unique, same-visible-text anchors and remain under `reference/live-anchor-alignment/`.
