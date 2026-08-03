declare module "@moss/ui/moss-id" {
  export const REGISTRATION_ADDRESS: string;
  export const OFFICIAL_INFO_URL: string;
  export function isEmail(value: unknown): boolean;
  export function buildRegistrationInstructions(email: unknown): {
    ok: boolean;
    error?: string;
    address: string;
    lines: string[];
    body: string;
    headline?: string;
    officialInfoUrl?: string;
    email?: string;
  };
  export function canEnterMossUserId(input: { email?: unknown; acknowledged?: unknown }): boolean;
  export function validateMossUserId(value: unknown): {
    ok: boolean;
    error?: string;
    digits: string;
  };
  export function maskMossUserId(value: unknown): {
    ok: boolean;
    error?: string;
    masked: string;
    digits: string;
  };
  export function resolveOnboardingGate(input: {
    account: unknown;
    entitled: boolean;
    mossConnected: boolean;
  }): "auth" | "paywall" | "moss-id" | "portal";
  export function isPortalUnlocked(input: { entitled: boolean; mossConnected: boolean }): boolean;
  export function validateMossIdModule(): { ok: boolean; errors: string[] };
}
