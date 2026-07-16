/**
 * Session Board (`/board`) — Kanban + list views over Omnigent sessions.
 *
 * Motivation: a long sidebar of chats does not surface what is running,
 * what needs a human, and what is done. This page reuses the same
 * `useConversations` list the sidebar uses (with archived included for
 * the Done column) and partitions rows via `sessionBoard.ts`.
 *
 * Click any card to open the session chat. v0 does not drag-and-drop
 * columns; archive a session (sidebar) to move it to Done.
 */

import { useEffect, useMemo, useState } from "react";
import {
  Columns3Icon,
  LayoutListIcon,
  Loader2Icon,
  SearchIcon,
  LayoutGridIcon,
} from "lucide-react";
import { PageScroll } from "@/components/PageScroll";
import { RunningDot } from "@/components/RunningDot";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useConversations, type Conversation } from "@/hooks/useConversations";
import { relativeTime } from "@/lib/relativeTime";
import { Link } from "@/lib/routing";
import {
  BOARD_COLUMNS,
  boardStatusChip,
  boardStatusChipLabel,
  filterSessionsByQuery,
  partitionSessionsForBoard,
  type BoardColumnId,
  type BoardStatusChip,
} from "@/lib/sessionBoard";
import { cn } from "@/lib/utils";
import { conversationDisplayLabel, getConversationAgentType } from "@/shell/sidebarNav";

type BoardViewMode = "board" | "list";

export function BoardPage() {
  const conversationsQuery = useConversations("", true, { reconcileWhileConnected: true });
  const [view, setView] = useState<BoardViewMode>("board");
  const [query, setQuery] = useState("");

  // Drain all pages so a running session on page 2 still appears.
  const { hasNextPage, isFetchingNextPage, fetchNextPage, isLoading, isError, refetch } =
    conversationsQuery;
  useEffect(() => {
    if (hasNextPage && !isFetchingNextPage) void fetchNextPage();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const allRows = useMemo(
    () => (conversationsQuery.data?.pages ?? []).flatMap((page) => page.data),
    [conversationsQuery.data?.pages],
  );

  // Board shows top-level sessions only — sub-agents clutter the view and
  // already nest under a parent chat. Mirror the sidebar's default focus.
  const topLevel = useMemo(
    () => allRows.filter((c) => c.parent_session_id == null || c.parent_session_id === ""),
    [allRows],
  );

  const filtered = useMemo(
    () => filterSessionsByQuery(topLevel, query, conversationDisplayLabel),
    [topLevel, query],
  );

  const buckets = useMemo(() => partitionSessionsForBoard(filtered), [filtered]);

  const assembling = isLoading || (hasNextPage && filtered.length === 0);

  return (
    <PageScroll className="flex h-full flex-col">
      <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-4 py-6 sm:px-6">
        <header className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-lg font-semibold tracking-tight">Board</h1>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Sessions as work — running, waiting on you, and done. Not a second project tracker.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-[12rem] flex-1 sm:flex-initial">
              <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search sessions"
                aria-label="Search sessions"
                className="h-8 pl-8 text-sm"
                data-testid="board-search"
              />
            </div>
            <div
              className="inline-flex rounded-lg border border-border p-0.5"
              role="group"
              aria-label="Board view mode"
            >
              <Button
                type="button"
                variant={view === "board" ? "secondary" : "ghost"}
                size="sm"
                className="h-7 gap-1.5 px-2.5 text-xs"
                aria-pressed={view === "board"}
                onClick={() => setView("board")}
                data-testid="board-view-board"
              >
                <Columns3Icon className="size-3.5" />
                Board
              </Button>
              <Button
                type="button"
                variant={view === "list" ? "secondary" : "ghost"}
                size="sm"
                className="h-7 gap-1.5 px-2.5 text-xs"
                aria-pressed={view === "list"}
                onClick={() => setView("list")}
                data-testid="board-view-list"
              >
                <LayoutListIcon className="size-3.5" />
                List
              </Button>
            </div>
          </div>
        </header>

        {isError && (
          <div
            data-testid="board-load-error"
            className="mb-4 flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm"
          >
            <span className="flex-1">Couldn’t load sessions for the board.</span>
            <Button variant="outline" size="sm" onClick={() => void refetch()}>
              Retry
            </Button>
          </div>
        )}

        {assembling && (
          <div className="flex items-center gap-2 py-12 text-sm text-muted-foreground">
            <Loader2Icon className="size-4 animate-spin" />
            Loading board…
          </div>
        )}

        {!assembling && filtered.length === 0 && (
          <div
            data-testid="board-empty"
            className="flex flex-col items-center gap-2 py-16 text-center"
          >
            <LayoutGridIcon className="size-8 text-muted-foreground/50" />
            <p className="text-sm font-medium">
              {query.trim() ? "No sessions match" : "No sessions yet"}
            </p>
            <p className="max-w-sm text-xs text-muted-foreground">
              {query.trim()
                ? "Try a different search."
                : "Start a session from the sidebar. Active work shows under Running; archive a session to move it to Done."}
            </p>
            {!query.trim() && (
              <Button asChild size="sm" className="mt-2">
                <Link to="/">New session</Link>
              </Button>
            )}
          </div>
        )}

        {!assembling && filtered.length > 0 && view === "board" && (
          <div
            className="grid flex-1 gap-4 md:grid-cols-3"
            data-testid="board-kanban"
          >
            {BOARD_COLUMNS.map((col) => (
              <BoardColumn
                key={col.id}
                columnId={col.id}
                title={col.title}
                description={col.description}
                sessions={buckets[col.id] as Conversation[]}
              />
            ))}
          </div>
        )}

        {!assembling && filtered.length > 0 && view === "list" && (
          <BoardList sessions={filtered} />
        )}

        {isFetchingNextPage && (
          <div className="mt-4 flex items-center justify-center gap-2 text-xs text-muted-foreground">
            <Loader2Icon className="size-3.5 animate-spin" />
            Loading more sessions…
          </div>
        )}
      </div>
    </PageScroll>
  );
}

function BoardColumn({
  columnId,
  title,
  description,
  sessions,
}: {
  columnId: BoardColumnId;
  title: string;
  description: string;
  sessions: Conversation[];
}) {
  return (
    <section
      data-testid={`board-column-${columnId}`}
      data-count={sessions.length}
      className="flex min-h-[12rem] flex-col rounded-xl border border-border bg-muted/30"
    >
      <div className="border-b border-border px-3 py-2.5">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-medium">{title}</h2>
          <span className="rounded-full bg-muted px-1.5 py-0.5 text-[11px] font-medium tabular-nums text-muted-foreground">
            {sessions.length}
          </span>
        </div>
        <p className="mt-0.5 text-[11px] text-muted-foreground">{description}</p>
      </div>
      <div className="flex flex-1 flex-col gap-2 p-2">
        {sessions.length === 0 ? (
          <p className="px-1 py-6 text-center text-xs text-muted-foreground/70">No sessions</p>
        ) : (
          sessions.map((session) => <SessionCard key={session.id} session={session} />)
        )}
      </div>
    </section>
  );
}

function SessionCard({ session }: { session: Conversation }) {
  const title = conversationDisplayLabel(session);
  const agent = getConversationAgentType(session);
  const chip = boardStatusChip(session);
  const when = relativeTime(session.updated_at * 1000);

  return (
    <Link
      to={`/c/${session.id}`}
      data-testid="board-card"
      data-session-id={session.id}
      className="block rounded-lg border border-border bg-card p-3 shadow-sm transition-colors hover:border-foreground/20 hover:bg-card/90"
    >
      <div className="flex items-start justify-between gap-2">
        <span className="min-w-0 flex-1 text-sm font-medium leading-snug">{title}</span>
        {chip.kind === "working" && <RunningDot />}
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <StatusChipBadge chip={chip} />
        {agent !== title && (
          <span className="truncate text-[11px] text-muted-foreground">{agent}</span>
        )}
      </div>
      <p className="mt-2 text-[11px] text-muted-foreground tabular-nums">{when}</p>
    </Link>
  );
}

function StatusChipBadge({ chip }: { chip: BoardStatusChip }) {
  const label = boardStatusChipLabel(chip);
  const tone =
    chip.kind === "needs_response"
      ? "border-transparent bg-warning/25 text-warning"
      : chip.kind === "failed"
        ? "border-transparent bg-destructive/15 text-destructive"
        : chip.kind === "working" || chip.kind === "launching" || chip.kind === "waiting_tools"
          ? "border-transparent bg-primary/10 text-primary"
          : "border-border bg-muted text-muted-foreground";

  return (
    <Badge variant="outline" className={cn("h-5 px-1.5 text-[10px] font-medium", tone)}>
      {label}
    </Badge>
  );
}

function BoardList({ sessions }: { sessions: Conversation[] }) {
  const ordered = useMemo(() => {
    const buckets = partitionSessionsForBoard(sessions);
    return BOARD_COLUMNS.flatMap((col) =>
      buckets[col.id].map((s) => ({ session: s as Conversation, column: col })),
    );
  }, [sessions]);

  return (
    <div
      className="overflow-hidden rounded-xl border border-border"
      data-testid="board-list"
    >
      <table className="w-full text-left text-sm">
        <thead className="border-b border-border bg-muted/40 text-xs text-muted-foreground">
          <tr>
            <th className="px-3 py-2 font-medium">Session</th>
            <th className="hidden px-3 py-2 font-medium sm:table-cell">Status</th>
            <th className="hidden px-3 py-2 font-medium md:table-cell">Agent</th>
            <th className="px-3 py-2 font-medium">Column</th>
            <th className="px-3 py-2 font-medium text-right">Updated</th>
          </tr>
        </thead>
        <tbody>
          {ordered.map(({ session, column }) => {
            const title = conversationDisplayLabel(session);
            const agent = getConversationAgentType(session);
            const chip = boardStatusChip(session);
            return (
              <tr
                key={session.id}
                className="border-b border-border last:border-0 hover:bg-muted/30"
                data-testid="board-list-row"
                data-session-id={session.id}
              >
                <td className="px-3 py-2.5">
                  <Link
                    to={`/c/${session.id}`}
                    className="font-medium text-foreground hover:underline"
                  >
                    {title}
                  </Link>
                </td>
                <td className="hidden px-3 py-2.5 sm:table-cell">
                  <StatusChipBadge chip={chip} />
                </td>
                <td className="hidden px-3 py-2.5 text-muted-foreground md:table-cell">
                  {agent}
                </td>
                <td className="px-3 py-2.5 text-muted-foreground">{column.title}</td>
                <td className="px-3 py-2.5 text-right text-xs text-muted-foreground tabular-nums">
                  {relativeTime(session.updated_at * 1000)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default BoardPage;
