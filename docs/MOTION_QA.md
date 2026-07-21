# Premium Motion QA

Validated: 2026-07-21

## Motion contract

- Shared durations and easing live in `src/styles/tokens.css`.
- Motion uses opacity and transforms except for bounded workspace panel resizing.
- Trading actions execute before confirmation or error animation is shown.
- Candles are never interpolated; replay state remains deterministic.
- `prefers-reduced-motion: reduce` collapses all animation and transition durations to `0.01ms`, disables repeated animation, and removes smooth scrolling.
- Idle float, route reveal, hero reveal, spotlight hover, and other decorative motion are declared only under `prefers-reduced-motion: no-preference`.

## Browser checks

| State                     | Result | Evidence                                                                             |
| ------------------------- | ------ | ------------------------------------------------------------------------------------ |
| Homepage initial reveal   | Pass   | Header, hero, preview, and progressive preview animations present in computed styles |
| Sticky navbar             | Pass   | Elevated background, blur, border, and shadow after scroll                           |
| Hero CTA hover            | Pass   | 120ms/190ms tactile transition and hover color/shadow verified                       |
| Floating product cards    | Pass   | Two independently delayed cards at desktop/tablet; hidden on small mobile            |
| Viewport entrances        | Pass   | Intersection observer revealed seven elements at the first content viewport          |
| Mobile navigation         | Pass   | 390×844 menu opens with `mt-content-enter`; no horizontal overflow                   |
| Tablet layout             | Pass   | 820×1000 desktop navigation and floating cards; no horizontal overflow               |
| Desktop layout            | Pass   | 1440×1000 hero and product preview render without layout overflow                    |
| Reduced-motion stylesheet | Pass   | Browser CSSOM contains global reduce override and decorative no-preference gates     |

Captured screenshots:

- `metatradee-home-desktop.png`
- `metatradee-home-scrolled.png`
- `metatradee-home-tablet.png`
- `metatradee-home-mobile-menu.png`

## Trading workspace checks

The `/chart` route is authentication protected in local development, so interactive workspace states were exercised through the component/integration suite with mocked session data rather than bypassing authentication.

| State                                                      | Result |
| ---------------------------------------------------------- | ------ |
| Left review panel desktop/drawer/sheet classes             | Pass   |
| Context tabs and preserved notes                           | Pass   |
| Tag add/remove and duplicate prevention                    | Pass   |
| Order drawer open/close and chart-instance preservation    | Pass   |
| Bottom panel expand/collapse and selected-tab preservation | Pass   |
| Replay Play/Pause and progress state                       | Pass   |
| Resume-follow suspended/following state                    | Pass   |
| Quick Buy/Sell and advanced order flow                     | Pass   |
| Accepted/rejected order state plumbing                     | Pass   |
| Real-only P&L rendering and accounting                     | Pass   |
| Deterministic replay viewport and future-data hiding       | Pass   |

Automated evidence:

- `tests/unit/chart/professional-workspace.test.tsx`: 31 passed
- Focused chart/replay/simulation suite: 69 passed
- TypeScript: passed
- Production build: passed
