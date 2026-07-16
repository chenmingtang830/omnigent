// Board page: partitions sessions into columns and switches Board/List.

import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";
import { BoardPage } from "./BoardPage";
import type { Conversation } from "@/hooks/useConversations";

vi.mock("@/hooks/useConversations", async (importActual) => ({
  ...(await importActual<typeof import("@/hooks/useConversations")>()),
  useConversations: vi.fn(),
}));

import * as conversationsHook from "@/hooks/useConversations";

function conversation(overrides: Partial<Conversation> = {}): Conversation {
  return {
    id: "sess_1",
    object: "conversation",
    title: "My Session",
    created_at: 1_700_000_000,
    updated_at: 1_700_000_000,
    labels: {},
    permission_level: null,
    pending_elicitations_count: 0,
    archived: false,
    status: "idle",
    ...overrides,
  };
}

function conversationsStub(rows: Conversation[], overrides: Record<string, unknown> = {}) {
  return {
    data: { pages: [{ data: rows, first_id: null, last_id: null, has_more: false }] },
    hasNextPage: false,
    isFetchingNextPage: false,
    fetchNextPage: vi.fn(),
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
    ...overrides,
  };
}

function renderBoard() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <BoardPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("BoardPage", () => {
  it("renders sessions into Running / Waiting for you / Done columns", () => {
    vi.mocked(conversationsHook.useConversations).mockReturnValue(
      conversationsStub([
        conversation({ id: "run", title: "Auth refactor", status: "running", updated_at: 3 }),
        conversation({
          id: "wait",
          title: "Needs human",
          status: "idle",
          pending_elicitations_count: 1,
          updated_at: 2,
        }),
        conversation({ id: "done", title: "Shipped", archived: true, updated_at: 1 }),
      ]) as ReturnType<typeof conversationsHook.useConversations>,
    );

    renderBoard();

    const running = screen.getByTestId("board-column-running");
    const waiting = screen.getByTestId("board-column-waiting_for_you");
    const done = screen.getByTestId("board-column-done");

    expect(within(running).getByText("Auth refactor")).toBeTruthy();
    expect(within(waiting).getByText("Needs human")).toBeTruthy();
    expect(within(done).getByText("Shipped")).toBeTruthy();
    expect(screen.getByText("Needs response")).toBeTruthy();
    expect(screen.getByText("Working…")).toBeTruthy();
  });

  it("switches to list view", () => {
    vi.mocked(conversationsHook.useConversations).mockReturnValue(
      conversationsStub([
        conversation({ id: "a", title: "Alpha", status: "running" }),
      ]) as ReturnType<typeof conversationsHook.useConversations>,
    );

    renderBoard();
    fireEvent.click(screen.getByTestId("board-view-list"));
    expect(screen.getByTestId("board-list")).toBeTruthy();
    expect(screen.getByTestId("board-list-row")).toBeTruthy();
    expect(screen.getByText("Alpha")).toBeTruthy();
  });

  it("filters by search query", () => {
    vi.mocked(conversationsHook.useConversations).mockReturnValue(
      conversationsStub([
        conversation({ id: "a", title: "Login bug", status: "idle" }),
        conversation({ id: "b", title: "Docs polish", status: "idle" }),
      ]) as ReturnType<typeof conversationsHook.useConversations>,
    );

    renderBoard();
    fireEvent.change(screen.getByTestId("board-search"), { target: { value: "login" } });
    expect(screen.getByText("Login bug")).toBeTruthy();
    expect(screen.queryByText("Docs polish")).toBeNull();
  });

  it("shows empty state when there are no sessions", () => {
    vi.mocked(conversationsHook.useConversations).mockReturnValue(
      conversationsStub([]) as ReturnType<typeof conversationsHook.useConversations>,
    );
    renderBoard();
    expect(screen.getByTestId("board-empty")).toBeTruthy();
    expect(screen.getByText("No sessions yet")).toBeTruthy();
  });
});
