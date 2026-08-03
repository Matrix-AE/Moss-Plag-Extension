// Minimal message contract for the shell. Full state ownership and migrations land in Prompt 024.
export const MESSAGE_ACTIONS = ["shell/ping", "shell/open-workspace", "shell/status"] as const;

export type MessageAction = (typeof MESSAGE_ACTIONS)[number];

export interface ShellMessage {
  action: MessageAction;
  requestId: string;
}

export interface ShellResponse {
  ok: boolean;
  action?: MessageAction;
  requestId?: string;
  error?: "unknown-action" | "malformed-message";
  payload?: Record<string, string | number | boolean>;
}

export function isShellMessage(value: unknown): value is ShellMessage {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate["requestId"] === "string" &&
    candidate["requestId"].length > 0 &&
    typeof candidate["action"] === "string" &&
    (MESSAGE_ACTIONS as readonly string[]).includes(candidate["action"])
  );
}
