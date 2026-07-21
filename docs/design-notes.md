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

Generic page-title bands were removed in favor of content-first toolbars and data panels. Static Plex weights improve Windows text rasterization, while the root type scale increases at 1440 px and 1920 px so large displays gain readable density instead of simply adding empty space.

Shell chrome now uses intrinsic fluid primitives instead of per-breakpoint widths: fill slots consume remaining toolbar space, market-tape columns share available width, and animated quote slots size themselves from their content. These constraints keep right edges aligned and prevent text clipping as the viewport or root type scale changes; on narrow screens the complete tape remains available through horizontal scrolling without widening the page.
