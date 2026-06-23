# WCAG Criterion Mapping

| Check | WCAG Criterion | Level | Why it matters |
|---|---|---|---|
| Missing `alt` on `<img>` | 1.1.1 Non-text Content | A | Screen readers announce nothing meaningful for the image without it. |
| Unlabeled form input | 4.1.2 Name, Role, Value | A | Assistive tech cannot announce what the field is for. |
| Clickable div/span without keyboard handler or role | 2.1.1 Keyboard | A | Keyboard-only users cannot activate the control at all. |

This is a small, deliberately high-value subset of WCAG 2.1 — the three
checks here are consistently among the most common real-world failures
found in automated accessibility audits across the web, which is why
they're the first pass implemented. They are not exhaustive: color
contrast, focus order, heading hierarchy, live region announcements, and
many other criteria are not covered by this skill.

## False Positive Notes

- **Decorative images** using `alt=""` intentionally are correct per WCAG
  and will not be flagged (the check is for *missing* `alt`, not empty
  `alt`).
- **Custom form components** (a wrapped `<select>` inside a third-party
  component library) may already handle labeling internally in ways this
  scanner cannot see through — verify in the rendered DOM before treating
  every hit as real.
- **Clickable divs inside already-interactive ancestors** (e.g. a div
  inside a `<button>`) may be redundant flagging — check context.

## Recommended Complementary Tools

`axe-core` (via `@axe-core/playwright` or similar) for automated DOM-level
checks this scanner cannot do, and manual testing with a screen reader
(VoiceOver, NVDA) for anything compliance-critical.
