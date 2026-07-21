# Design notes

MarketDesk is a working financial application, not a marketing site. Its layout combines Koyfin-style multi-panel density, TIKR-style compact fundamentals, TradingView-like chart controls, and IBM Carbon-inspired spacing and table rhythm.

## Decisions

- Near-black neutral surfaces and restrained blue/green/red semantics keep focus on data.
- Square panels, thin borders, 4 px controls, and tabular numerals avoid decorative card styling.
- The persistent desktop rail becomes bottom navigation on smaller screens.
- Tables preserve density with horizontal overflow instead of hiding decision-critical fields.
- Client components are limited to navigation state, filters, and Recharts; mock data and validation remain centralized.
- Motion is intentionally minimal, and the stylesheet respects `prefers-reduced-motion`.
