# Pi Touchscreen Home Copy Layout

## Task summary
- Refined the `pi-touchscreen` home screen copy and layout after visual review.

## Scope
- Changed home screen display text only where it clarified the current UI.
- Removed the automatic inspection status row from the home status panel.
- Kept inspection start/stop behavior, state transitions, API calls, and canvas rendering unchanged.

## Changed files
- `pi-touchscreen/index.html`
- `pi-touchscreen/style.css`
- `pi-touchscreen/app.js`
- `docs/worklogs/_index.md`
- `docs/worklogs/2026-06-03_pi-touchscreen-home-copy-layout.md`

## Verification result
- Checked CSS brace balance: `open=73`, `close=73`.
- Confirmed updated visible labels:
  - `검사 대기`
  - `검사 장치`
  - `결과 저장 서버`
- Confirmed the removed `auto-state` element is now guarded in JavaScript before assignment.
- Did not run a browser visual check because no local touchscreen server was started for this task.

## Decisions made
- Replaced `자동 검사 대기` with `검사 대기` to prevent wrapping in the 800px touchscreen layout.
- Replaced `로컬 서버` with `검사 장치` to indicate the Raspberry Pi/edge device status more clearly.
- Replaced `중앙 서버` with `결과 저장 서버` to clarify that the URL is the destination server for backend results.
- Removed `자동 검사 / 중지됨` from the home panel because the home screen is only visible before automatic inspection starts.

## Issues
- None found during static verification.

## Next steps
- Open `/touch` on the target 800x480 display and confirm the title and status panel fit visually.
