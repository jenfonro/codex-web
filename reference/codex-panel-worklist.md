# Codex Panel Implementation Worklist

## Boundary Rules
- Source of truth is captured code-server ChatGPT/Codex extension DOM, class names, computed styles, and the live code-server extension JS/CSS assets saved under `reference/extension-source/openai.chatgpt-26.5623.31443`.
- Do not invent a similar-looking UI when a captured structure or style exists.
- Reuse `frontend/src/assets/chatgpt/*.css` as exact copied extension CSS assets; local CSS is only for host isolation, static layout glue, and data-binding hooks.
- Keep the Codex panel in the left code-server sidebar.
- Do not add auth/login UI.
- Screenshots are final verification only after DOM/class/style alignment.
- Source alignment audit must pass before visual comparison: copied extension CSS assets must be byte-for-byte exact against `reference/extension-source`, and local class names, data attributes, and CSS selectors need to exist in captured extension HTML, official extension assets, or the explicit adapter allowlist.
- Do not keep re-checking the same screenshot symptom. Classify mismatches by source/DOM/markup/computed-style first, fix the actionable category once, then re-run the audit.
- For shell-level drift, compare the full code-server chrome class/DOM/computed-style category first. Fix proven shared causes such as font, layout flow, titlebar shadow, sidebar content background, and activity icon source; do not tune one visible symptom repeatedly.
- Computed-style differences caused only by captured viewport/sidebar size must be reported separately as `environment-size`; they are not a reason to alter product CSS to chase a non-stable number.
- Reference screenshots contain dynamic sample time labels (`42 分`, `50 分`, `53 分`, `56 分`) because captures were taken minutes apart. Treat those labels as content data, not as a style/layout pass condition.

## Current Plan
- [x] Confirm the current implementation still contains hand-written utility/token CSS.
- [x] Confirm extracted official extension CSS assets are present in `frontend/src/assets/chatgpt`.
- [x] Mount the Codex panel in Shadow DOM and load real extension CSS assets there.
- [x] Replace global `codex-panel.css` with host-only styles.
- [x] Add shadow-only adapter CSS for frame sizing, static composer/thread layout, popovers, and code-server codicon font isolation.
- [x] Re-check session list DOM/classes against `reference/codex-reference/codex-reference.json`.
- [x] Re-check thread DOM/classes, user bubble, markdown, summary, activity rows, composer, plus menu, approval menu, and model menu.
- [x] Run syntax/build verification.
- [x] Capture local screenshots and compare against Windows reference captures.
- [x] Add any new mismatch found during audit back into this checklist before finalizing.
- [x] Run DOM-first audit after final rebuild and confirm every tracked component is `exact`.
- [x] Run final CDP screenshot capture after DOM audit reached `nonExact=0`.
- [x] Add source alignment audit that compares local source against captured extension HTML and official extension CSS before screenshots.
- [x] Remove verification-only DOM hooks that did not exist in the captured extension DOM.
- [x] Capture live code-server extension JS/CSS assets through authenticated `vscode-remote-resource` and use them as the source audit basis.
- [x] Replace corrupted MHTML-extracted CSS assets with byte-for-byte live extension CSS assets.
- [x] Remove local placeholder and attachment padding shims that only existed to compensate for corrupted CSS.
- [x] Fix Windows build output so `build-all.sh` writes `codex-web.exe` and `codex-agent.exe` via `go env GOEXE`; this prevents stale extensionless/`.exe` binaries from being mixed during local verification.
- [x] Rebuild, restart the controller from the latest Windows binary, and verify the served `codex-panel.js` hash matches `backend/public/dist/codex-panel.js`.
- [x] Update CDP verification to capture the Codex panel before full-page screenshots, so full-page screenshot instability does not block panel-level visual evidence.
- [x] Record the visual-only thread regression found after DOM audit: the local thread panel showed a blank virtual-list region above the composer because adapter CSS overrode the official scroll shell shrink/min-height behavior.
- [x] Remove the local thread content-shell flex/min-height overrides so the captured extension scroll shell owns the scroll height and bottom anchoring.
- [x] Rebuild, restart, rerun source/markup audits, and recapture local list/thread screenshots after the scroll-shell fix.
- [x] Add computed-style audit classification so real class/color/font/border/radius/shadow/gap/button-size mismatches fail, while viewport/sidebar-propagated dimensions remain visible as environment-size rows.
- [x] Fix ProseMirror focused state to match captured runtime state: list and plus menu focused; approval/model/thread unfocused.
- [x] Restore webview-like fixed positioning behavior for shadow content by making `#codexPanel` the containing block for fixed overlay layers.
- [x] Disable the toast viewport `md:pb-5` effect inside the side panel, because official webview media queries are evaluated against the panel iframe width while the Shadow DOM host otherwise sees the full page viewport.
- [x] Run computed-style verification at the exact reference viewport (`1904x985`) and reference-derived per-view sidebar widths (`611` for list/thread, `580` for menus).
- [x] Update final CDP screenshot verification to capture list/thread at `610x893` and plus/approval/model at `579x893`, matching the reference webview panel dimensions.
- [x] Add source-backed dynamic state coverage instead of continuing to re-check already-zero static screenshots.
- [x] Download the missing official dynamic component JS assets: `thinking-shimmer-B8u0gTMT.js`, `tool-activity-disclosure-BLOD7VGb.js`, `timeline-item-kfxn1jgJ.js`, `local-conversation-turn-BZInUTC2.js`, and `worktree-init-tool-activities-B1o2n3Qp.js`.
- [x] Extract exact dynamic DOM/class patterns for thinking shimmer, activity disclosure rows, timeline rows, and turn followups from official extension JS or live DOM.
- [x] Replace any local dynamic placeholder class/DOM that is not backed by captured extension output.
- [x] Extend source/DOM/markup/computed-style audits to track dynamic components separately from static list/thread/menu components.
- [x] Add a local pending/running fixture only after its DOM/classes are source-backed.
- [x] Run syntax, source, DOM, markup, computed-style, screenshot, Go tests, and Windows build verification after dynamic coverage is implemented.
- [x] Add auxiliary pixel visual-diff audit for panel and shell screenshots without weakening source/DOM/markup/computed-style gates.
- [x] Add `?codexFixture=reference` so visual screenshots can use stable sample data without touching normal API-backed runtime behavior.
- [x] Restore the code-server active sidebar sash color and placement from reference pixels.
- [x] Re-align approval and model Radix menu overlay positions against reference screenshots while keeping captured DOM/markup exact.
- [x] Make DOM structure and markup alignment audits fail with a nonzero exit code when any tracked component is not `exact`.
- [x] Add `scripts/run-codex-panel-audits.ps1` so source, DOM, markup, computed-style, and dynamic audits run serially in a clean temporary Chrome instead of sharing a user browser state.
- [x] Run and stabilize code-server shell audit against the captured Windows code-server shell.
- [x] Replace the hand-made Codex activity icon with the captured `uri-icon` activity label and extension `blossom-black.svg` mask.
- [x] Move the outer shell layout from absolute-positioned stand-ins toward the captured static code-server split-view geometry without changing the left-sidebar Codex panel behavior.
- [x] Re-run shell/style/panel audits after rebuilding and record remaining mismatches by category instead of re-checking the same screenshot symptom.

## Closed Mismatches
- [x] Composer height was 92px locally vs 100px in the captured extension. Fixed by restoring the missing `_attachmentsDefault_1u8sk_2` top inset from the captured layout.
- [x] CDP verification captured plus/approval/model menus on the thread page while the Windows references were captured on the session list page. Fixed the verification flow to capture all three composer menus before opening a thread.
- [x] Assistant action, summary, and activity rows were aligned against captured DOM/classes instead of verification-only data hooks.
- [x] CDP thread screenshots did not show assistant action buttons because no hover state was simulated. Verification now hovers the assistant message before the thread screenshot.
- [x] List root had the external footer nested under the composer `relative` node. Moved it to the captured sibling position under `relative flex w-full flex-col gap-2`.
- [x] Thread composer was mounted outside the scroll shell. Moved `data-thread-scroll-footer="true"` under the captured `flex min-h-full shrink-0 flex-col justify-start` shell.
- [x] Conversation audit compared a local tool summary list against captured assistant markdown paragraphs. Updated the reference sample turn order so assistant markdown, user bubble, summary, and activity rows compare like-for-like.
- [x] Local toast layer added an extra root node that is absent from the captured extension DOM. Removed the unused render function and shadow CSS.
- [x] Source alignment audit initially flagged local-only `data-assistant-message`, `data-virtualized-turn-content`, and `data-codex-activity-row`. Removed them and updated verification to use captured selectors.
- [x] Previous source audit used `frontend/src/assets/chatgpt` as the official CSS source, which allowed local corrupted assets to self-validate. Audit now compares copied CSS against `reference/extension-source/openai.chatgpt-26.5623.31443/webview/assets`.
- [x] MHTML-extracted CSS had invalid empty declarations, including `composer-CXInBfIq.css` missing `padding:var(--composer-attachment-inset)`. Replaced all extension CSS files with live code-server downloads and verified copied assets are exact.
- [x] `codex-panel-shadow.css` contained local placeholder and `_attachmentsDefault_1u8sk_2` padding overrides. Removed those so the official `prompt-editor`, `prosemirror`, and `composer` CSS owns those styles.
- [x] Windows Git Bash generated new extensionless binaries while an older `build/codex-web.exe` was still running. Updated `build.sh` to use `go env GOEXE`, rebuilt, and restarted `build/codex-web.exe`.
- [x] CDP `fromSurface=false` full-page captures rendered black screenshots. Restored `fromSurface=true` and kept panel-first capture order.
- [x] Thread visual capture showed only header and composer while the reference showed recent messages above the composer. The adapter CSS forced `[data-thread-content-shell]` and its portal child to shrink, which broke the official `min-h-full shrink-0` scroll shell. Removed those adapter overrides; pending final screenshot verification.
- [x] Composer border/shadow and fixed-size button differences were caused by missing Tailwind custom property initialization in the shadow root. Restored the required Tailwind variables under `#root`.
- [x] Approval/model/thread composer incorrectly kept `ProseMirror-focused`. Runtime class now follows the captured extension state per view/popover.
- [x] Fixed overlay/toast sizing used the full browser viewport instead of the code-server webview panel. Added a host containing block on `#codexPanel` and a narrow toast viewport adapter.
- [x] Existing attached Chrome CDP sessions could intermittently hang on `Page.captureScreenshot` after dynamic-state verification. Added `scripts/verify-codex-panel-playwright.py` with `PLAYWRIGHT_LAUNCH=1` so final screenshots run in a clean temporary Chrome while keeping the same DOM/state/metric checks.
- [x] Playwright verification initially read reference `#root` metrics as an object while the captured JSON stores selector rows as arrays; menu screenshots fell back to 611px. Fixed the reader so plus/approval/model capture at the reference 579px panel width.
- [x] The code-server active sidebar sash was gray/transparent locally while reference pixels at the sash are `rgb(0,105,204)`. Restored the 4px active blue sash on `.sidebar-resize-handle`.
- [x] Approval/model menus were anchored too high and model was too far right. Updated the shadow adapter overlay offsets so approval/model menus overlap the composer like the captured extension.
- [x] A temporary virtual-list offset tweak improved one screenshot but broke captured markup exactness; reverted it and kept the reference `margin-top: 23068px` because source/DOM/markup evidence takes priority over pixel chasing.
- [x] DOM and markup audit scripts previously wrote reports but could exit successfully when non-exact rows appeared. They now print failing components and return nonzero, so verification cannot silently accept drift.
- [x] Manual CDP audit runs were easy to contaminate by parallel scripts or the active user browser. Added a single audit runner that starts a temporary headless Chrome, runs audits in order, and tears it down.

## Structure Refactor Notes
- [x] Split the static Codex panel runtime out of the single large `frontend/src/codex-panel.js` file into focused runtime files under `frontend/src/codex-panel/`: `config.js`, `utils.js`, `api.js`, `fixtures.js`, and `renderer.js`.
- [x] Replaced the stale `frontend/src/app.js` explorer/demo script with `frontend/src/shell.js`, which only owns platform class detection and sidebar resizing.
- [x] Renamed the local panel wrapper from `codex-webview` to `codex-panel-frame`, and renamed the local variable stylesheet from `codex-webview-vars.css` to `codex-panel-vars.css`.
- [x] Kept official extension DOM/classes and copied CSS assets intact for visual parity; the refactor only changes our local runtime organization and adapter naming.
- [x] Tested a combined CSS bundle and rejected it because it changed Tailwind layer/cascade behavior and produced computed-style radius drift. Runtime continues to load the copied local CSS assets in the proven order.
- [x] Removed the remote `sourceMappingURL` hint from the local code-server workbench CSS so local devtools do not reference `main.vscode-cdn.net`.
- [x] Changed static serving headers: `index.html` uses `Cache-Control: no-cache`, static assets use `Cache-Control: public, max-age=3600`, and `Clear-Site-Data` is no longer sent for every asset.
- [x] Rebuilt, restarted, and re-ran source, shell, DOM, markup, computed, dynamic, Go, screenshot, and visual-diff verification after the refactor.

## Latest Verification
- Syntax: `node --check frontend/src/codex-panel.js`, `node --check scripts/capture-chatgpt-extension-source.cjs`, `node --check scripts/audit-codex-source-alignment.cjs`, `node --check scripts/audit-codex-dynamic-states.cjs`, `node --check scripts/audit-codex-dom-structure.cjs`, `node --check scripts/audit-codex-markup-alignment.cjs`, `node --check scripts/audit-codex-computed-styles.cjs`, `node --check scripts/verify-codex-panel-cdp.cjs`, `python -m py_compile scripts/verify-codex-panel-playwright.py`, and PowerShell parse check for `scripts/audit-codex-visual-diff.ps1`.
- Unified audit runner: `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/run-codex-panel-audits.ps1 -CdpPort 9338` passed after the latest rebuild/restart; it runs source, shell, DOM, markup, computed-style, and dynamic audits serially in a temporary Chrome.
- Extension source capture: `reference/extension-source/openai.chatgpt-26.5623.31443`, generated `2026-07-03T14:31:08.138Z`; key JS/CSS assets downloaded from live code-server with status `200`.
- Source audit: `reference/codex-reference/source-alignment-audit.md`, generated `2026-07-03T18:18:59.045Z`, unexplained class/data/CSS counts all `0`, copied extension CSS non-exact count `0`.
- DOM structure audit: `reference/codex-reference/dom-structure-audit.md`, generated `2026-07-03T18:19:02.961Z`; every tracked component is `exact`, and any non-exact component now fails the command.
- Markup audit: `reference/codex-reference/markup-alignment-audit.md`, generated `2026-07-03T18:19:05.861Z`; list, plus, approval, model, and thread tracked components are all `exact`, and any non-exact component now fails the command.
- Computed-style audit: `reference/codex-reference/computed-style-audit.md`, generated `2026-07-03T18:19:13.207Z`; actionable differences `0`, environment-size differences `0`, total differences `0`, missing elements `0`.
- Build: `./build-all.sh` from Git Bash on Windows; generated `build/codex-web.exe` and `build/codex-agent.exe`.
- Runtime: local `build/codex-web.exe` restarted after build, serving `http://127.0.0.1:58888/` from PID `9928`.
- Tests: `go test ./...` in `backend` and `agent` passed.
- Screenshots/metrics, normal runtime: `reference/windows-captures/20260704-022027-local-codex-panel-playwright`; `PLAYWRIGHT_LAUNCH=1`; viewport `1904x985`; sidebar widths `611` for list/thread and `580` for menus; all list/plus/approval/model/thread states have both panel and full screenshots.
- Screenshots/metrics, reference fixture: `reference/windows-captures/20260704-022039-local-codex-panel-playwright`; `PANEL_URL=http://127.0.0.1:58888/?codexFixture=reference`; used for visual-diff audit only.
- Visual diff audit: `reference/codex-reference/visual-diff-audit.md`, generated `2026-07-03T18:21:07.3132657Z`; list panel diff `1.3502%`, plus panel `2.7032%`, approval panel `3.0798%`, model panel `3.0409%`; thread pixel diff remains content/text-window dominated and is not used to override exact DOM/markup/computed evidence.
- Screenshot coverage: list, plus, approval, model, and thread all have panel and full screenshots. The thread panel shows recent conversation content above the composer instead of a blank virtual-list region.
- Key metrics: list composer `578x100`, composer footer `576x28`, thread composer `563x100` with scrollbar gutter, official extension border/shadow/font computed styles present.
- Dynamic state audit: `reference/codex-reference/dynamic-state-audit.md`, generated `2026-07-03T18:19:14.369Z`; checks `thinking-shimmer`, cadenced shimmer sweep/highlight/active class, running `group/activity-header`, expanded disclosure body, and source snippets from official extension assets; failed checks `0`.
- Shell style audit: `reference/codex-reference/shell-style-audit.md`, generated `2026-07-03T18:19:01.251165Z` after the shell-root fix; tracked rows `23`, actionable differences `0`, missing rows `0`. This removed the previous shared drift categories: `Microsoft YaHei` fallback inheritance, absolute shell part positioning, titlebar shadow, sidebar content background/overflow, activity item color/font, and the hand-made Codex activity icon.

## Reference Captures
- Session list: `reference/windows-captures/20260702-184840-codex-session-list-wide-611`
- Thread: `reference/windows-captures/20260702-185302-codex-thread-wide-611`
- Plus menu: `reference/windows-captures/20260702-185715-codex-thread-plus-menu-wide-611-stable`
- Approval menu: `reference/windows-captures/20260702-185942-codex-thread-approval-menu-wide-stable`
- Model menu: `reference/windows-captures/20260702-190248-codex-thread-model-menu-right-wide-stable`

## Local Adapter Allowlist
- Shadow DOM boundary to prevent extension Tailwind/base CSS from mutating the code-server shell.
- `data-codex-panel-root`, `data-thread-content-shell`, `data-popover`, `data-codex-session-id`, `data-codex-assistant-actions`, and `data-codex-summary-row` as behavior/layout/verification hooks.
- Local `codex-floating-menu-*` positioning because this static controller does not run Radix/Floating UI.
