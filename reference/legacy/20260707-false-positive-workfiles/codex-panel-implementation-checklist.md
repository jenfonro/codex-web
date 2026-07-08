# Codex Panel Implementation Checklist

Source of truth:
- Windows Chrome captures in `reference/windows-captures/20260702-184840-codex-session-list-wide-611`
- Windows Chrome captures in `reference/windows-captures/20260702-185302-codex-thread-wide-611`
- Popover captures from `20260702-185715`, `20260702-185942`, and `20260702-190248`

Boundaries to re-check on every item:
- Copy/adapt captured DOM, class names, dimensions, icons, spacing, colors, and interactions.
- Do not invent a similar-looking UI when the captured structure gives the answer.
- Keep the Codex panel in the left sidebar.
- Do not add auth/login UI.
- Preserve the captured workspace chrome and only change Codex Web adapter details needed for alignment.

Tasks:
- [x] Capture and inspect current local list/thread baselines.
- [x] Move the external footer (`本地模式`) out of the white composer surface so composer height matches the captured 100px surface.
- [x] Hide the outer sidebar title overflow action when the Codex webview already renders the captured header actions.
- [x] Add the captured thread header overflow action between the thread title and recent-task/settings/new-chat actions.
- [x] Re-check list, thread, plus menu, approval menu, and model menu screenshots after implementation.
- [x] Run syntax checks and full build.
- [x] Restart local `codex-web` on `http://127.0.0.1:58888/`.

Final local captures:
- `reference/windows-captures/20260702-215611-local-final-list`
- `reference/windows-captures/20260702-215613-local-final-thread`
- `reference/windows-captures/20260702-215632-local-final-plus`
- `reference/windows-captures/20260702-215633-local-final-approval`
- `reference/windows-captures/20260702-215633-local-final-model`

Final verification notes:
- Composer surface is 100px high and no longer shows an internal scrollbar.
- Composer footer buttons match captured dimensions: approval 100x20, model 81.55x28, IDE context 94.97x28.
- Footer button text is 12px / 18px line-height, matching the captured extension frame.
