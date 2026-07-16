/**
 * Session Board — map Omnigent sessions onto a lightweight execution board.
 *
 * This is intentionally NOT a full project-management model. Cards are
 * existing sessions; columns reflect agent execution state so users can
 * scan work instead of scrolling a long chat list.
 *
 * Column semantics (v0):
 * - **running** — agent is actively working (or mid-turn / waiting on tools)
 * - **waiting_for_you** — needs human input (approvals) or is idle and ready
 * - **done** — archived
 *
 * Priority when multiple apply: done > running > waiting_for_you.
 * (Archived always wins so Done stays stable.)
 */

import type { Conversation } from "@/hooks/useConversations";
import type { SessionStatus } from "@/lib/types";

export type BoardColumnId = "running" | "waiting_for_you" | "done";

export interface BoardColumnDef {
  id: BoardColumnId;
  /** Short column header in the UI. */
  title: string;
  /** One-line helper under the title. */
  description: string;
}

/** Fixed column order for Board view. */
export const BOARD_COLUMNS: readonly BoardColumnDef[] = [
  {
    id: "running",
    title: "Running",
    description: "Agent is working",
  },
  {
    id: "waiting_for_you",
    title: "Waiting for you",
    description: "Needs a response or ready to continue",
  },
  {
    id: "done",
    title: "Done",
    description: "Archived sessions",
  },
] as const;

/**
 * Minimal session fields the board needs.
 *
 * Sidebar `Conversation.status` is typed as a subset (`idle|running|failed`);
 * the live snapshot / stream may also emit `launching` / `waiting`. Accept
 * the full `SessionStatus` union so column mapping stays accurate.
 */
export type BoardSession = Pick<
  Conversation,
  "id" | "pending_elicitations_count" | "archived" | "updated_at" | "title" | "labels"
> & {
  status?: SessionStatus | Conversation["status"];
};

/**
 * Chip shown on a card — human-readable "what is going on".
 * Kept short so it fits a Kanban card.
 */
export type BoardStatusChip =
  | { kind: "working" }
  | { kind: "launching" }
  | { kind: "waiting_tools" }
  | { kind: "needs_response"; count: number }
  | { kind: "idle" }
  | { kind: "failed" }
  | { kind: "archived" };

export function boardColumnForSession(session: BoardSession): BoardColumnId {
  if (session.archived === true) return "done";
  const status = session.status;
  if (status === "running" || status === "launching" || status === "waiting") {
    return "running";
  }
  // idle, failed, or unknown → human-facing column
  return "waiting_for_you";
}

export function boardStatusChip(session: BoardSession): BoardStatusChip {
  if (session.archived === true) return { kind: "archived" };
  const pending = session.pending_elicitations_count ?? 0;
  if (pending > 0) return { kind: "needs_response", count: pending };
  switch (session.status) {
    case "running":
      return { kind: "working" };
    case "launching":
      return { kind: "launching" };
    case "waiting":
      return { kind: "waiting_tools" };
    case "failed":
      return { kind: "failed" };
    default:
      return { kind: "idle" };
  }
}

/** Human label for a status chip (English UI copy matches the rest of web). */
export function boardStatusChipLabel(chip: BoardStatusChip): string {
  switch (chip.kind) {
    case "working":
      return "Working…";
    case "launching":
      return "Starting…";
    case "waiting_tools":
      return "Waiting…";
    case "needs_response":
      return chip.count === 1 ? "Needs response" : `Needs response (${chip.count})`;
    case "idle":
      return "Ready";
    case "failed":
      return "Failed";
    case "archived":
      return "Archived";
  }
}

export interface BoardBuckets {
  running: BoardSession[];
  waiting_for_you: BoardSession[];
  done: BoardSession[];
}

/**
 * Partition sessions into board columns. Within each column, sort by
 * `updated_at` descending (most recently active first).
 */
export function partitionSessionsForBoard(sessions: readonly BoardSession[]): BoardBuckets {
  const buckets: BoardBuckets = {
    running: [],
    waiting_for_you: [],
    done: [],
  };
  for (const session of sessions) {
    buckets[boardColumnForSession(session)].push(session);
  }
  for (const id of Object.keys(buckets) as BoardColumnId[]) {
    buckets[id].sort((a, b) => (b.updated_at ?? 0) - (a.updated_at ?? 0));
  }
  return buckets;
}

/** Case-insensitive title filter for the board search box. */
export function filterSessionsByQuery<T extends BoardSession & { title?: string | null }>(
  sessions: readonly T[],
  query: string,
  displayLabel: (s: T) => string,
): T[] {
  const q = query.trim().toLowerCase();
  if (!q) return [...sessions];
  return sessions.filter((s) => displayLabel(s).toLowerCase().includes(q));
}
