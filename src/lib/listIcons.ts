// Design Lead, draft-screen v3 list icons. 24x24 viewBox, stroke icons, currentColor.
// Render: <svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke="currentColor"
//   strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" role="img" aria-label={list.title}>
// tone "up" = --fh-champagne #F7E7CE; tone "risk" = the existing below-average red already used in You vs Avg.
// Keyed by insights.json list id. Unknown ids use FALLBACK with the list's own title.
export type ListIcon = { d: string; tone: "up" | "risk" };
export const LIST_ICONS: Record<string, ListIcon> = {
  off:            { tone: "up",   d: "M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18M12 8a4 4 0 1 0 0 8a4 4 0 1 0 0-8M12 11.2v1.6" }, // target
  def:            { tone: "up",   d: "M12 3l7 3v5c0 4.5-3 8-7 10c-4-2-7-5.5-7-10V6z" }, // shield
  eff:            { tone: "up",   d: "M4 16a8 8 0 0 1 16 0M12 16l4-5M3 16h2M19 16h2" }, // gauge
  young:          { tone: "up",   d: "M12 21v-9M12 12c0-4 3-6 7-6c0 4-3 6-7 6M12 14c0-3-2.5-5-6-5c0 3 2.5 5 6 5" }, // sprout
  prime_breakout: { tone: "up",   d: "M3 17l6-6l4 4l8-8M15 7h6v6" }, // trending up
  late_riser:     { tone: "up",   d: "M3 19h18M7 19a5 5 0 0 1 10 0M12 4v7M9 7l3-3l3 3" }, // sunrise
  comeback:       { tone: "up",   d: "M4 12a8 8 0 1 0 2.5-5.8M4 4v4h4" }, // return arrow
  avoid:          { tone: "risk", d: "M3 7l6 6l4-4l8 8M15 17h6v-6" }, // trending down (Decline)
  availability:   { tone: "risk", d: "M5 4h14a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1M12 8v8M8 12h8" }, // medical cross (Injury-prone)
  rarity:         { tone: "up",   d: "M6 4h12l3 5l-9 11L3 9zM3 9h18M9 4l3 16l3-16" }, // gem
  hot:            { tone: "up",   d: "M12 21c-4 0-6-2.5-6-6c0-4 4-6 4-11c3 2 8 6 8 11c0 3.5-2 6-6 6M12 21c-1.7 0-2.5-1.2-2.5-2.7c0-2 2.5-3.3 2.5-5.3c1.2 1 2.5 2.7 2.5 5.3c0 1.5-.8 2.7-2.5 2.7" }, // flame
  cold:           { tone: "risk", d: "M12 3v18M4.2 7.5l15.6 9M4.2 16.5l15.6-9M10 5l2 2l2-2M10 19l2-2l2 2" }, // snowflake
};
export const FALLBACK_ICON: ListIcon = { tone: "up", d: "M12 4a8 8 0 1 0 0 16a8 8 0 1 0 0-16M12 11v.01" }; // ring + dot
export const ICON_ROW_CAP = 3; // then "+N" pill; order = Analyst's priority
