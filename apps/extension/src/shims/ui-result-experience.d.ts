export const REVIEW_GUIDANCE: readonly string[];
export const WARNINGS_BASE: readonly string[];

export interface ResultAction {
  id: string;
  label: string;
  disabled: boolean;
}

export interface ResultExperienceView {
  ok: boolean;
  completedAt: string;
  language: string | null;
  mode: string;
  reportUrl: string | null;
  autoOpen: boolean;
  fabricatePercent: boolean;
  pastEstimate: boolean;
  open: { href: string | null; rel: string; target: string };
  actions: Record<string, ResultAction>;
  warnings: string[];
  reviewGuidance: string[];
  a11y: { role: string; ariaLabel: string; live: string; keyboardOrder: string[] };
}

export function buildResultExperience(input: {
  completedAt: string;
  language: string | null;
  mode: string;
  availabilityEstimate?: { availableUntil: number } | null;
  reportUrl?: string | null;
  urlForgotten?: boolean;
  now?: number;
}): ResultExperienceView;

export function performAction(
  view: ResultExperienceView,
  actionId: string,
): { ok: boolean; error?: string; url?: string | null; copied?: boolean; forgotten?: boolean };
