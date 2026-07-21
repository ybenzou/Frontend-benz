# Design notes

MarketDesk is a working financial application, not a marketing site. Its layout combines Koyfin-style multi-panel density, TIKR-style compact fundamentals, TradingView-like chart controls, and IBM Carbon-inspired spacing and table rhythm.

## Decisions

- Near-black neutral surfaces and restrained cyan/emerald/coral semantics keep focus on data.
- Low-radius panels, quiet dividers, compact controls, and tabular numerals avoid decorative card styling.
- The persistent desktop rail becomes bottom navigation on smaller screens.
- Tables preserve density with horizontal overflow instead of hiding decision-critical fields.
- Client components are limited to navigation state, filters, and Recharts; mock data and validation remain centralized.
- Motion is intentionally minimal, and the stylesheet respects `prefers-reduced-motion`.

## Institutional terminal refresh

The interface now uses local IBM Plex Sans and Plex Mono, a fixed 72 px icon rail, and an integrated mock market tape to return more width to research. Midnight ink and graphite surfaces, platinum text, muted cyan, emerald, and coral form the semantic palette; hierarchy comes from luminance, spacing, and type scale rather than decorative cards. Overview uses an asymmetric 12-column decision layout, while Research gives its clearly labelled deterministic simulated quote the strongest visual and motion emphasis.
