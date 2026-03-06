export const DAY_MS = 86_400_000;

/**
 * Step definitions — the canonical list of drip emails.
 * UI state (sent/sending/scheduled) is now driven by SSE events,
 * not computed from virtual time.
 */
export const STEP_DEFINITIONS = [
  { day: 0, label: "Welcome Email" },
  { day: 1, label: "Getting Started Tips" },
  { day: 3, label: "Feature Highlights" },
  { day: 7, label: "Follow-up & Feedback" },
];

export const STEP_START_TIMES_MS = STEP_DEFINITIONS.map((s) => s.day * DAY_MS);

const LAST_STEP_DAY = STEP_DEFINITIONS[STEP_DEFINITIONS.length - 1].day;
const SEND_DURATION_MS = 8_640_000; // 0.1d — used only for progress bar end position
export const CAMPAIGN_COMPLETE_VIRTUAL_MS = LAST_STEP_DAY * DAY_MS + SEND_DURATION_MS;

export const CAMPAIGN_SEGMENTS = [
  { startMs: 0, endMs: DAY_MS },
  { startMs: DAY_MS, endMs: 3 * DAY_MS },
  { startMs: 3 * DAY_MS, endMs: CAMPAIGN_COMPLETE_VIRTUAL_MS },
];

export function clampVirtualTime(virtualTimeMs: number): number {
  if (typeof virtualTimeMs !== "number" || Number.isNaN(virtualTimeMs) || !Number.isFinite(virtualTimeMs)) {
    return 0;
  }
  return Math.max(0, Math.min(CAMPAIGN_COMPLETE_VIRTUAL_MS, virtualTimeMs));
}

export function formatVirtualClock(virtualTimeMs: number) {
  const normalized = clampVirtualTime(virtualTimeMs);
  const day = Math.floor(normalized / DAY_MS);
  const remainder = normalized % DAY_MS;
  const totalMinutes = Math.floor((remainder / DAY_MS) * 24 * 60);
  const hours = Math.floor(totalMinutes / 60);

  return `Day ${day}, ${hours.toString().padStart(2, "0")}:00`;
}
