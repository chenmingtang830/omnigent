import { describe, expect, it } from "vitest";
import {
  boardColumnForSession,
  boardStatusChip,
  boardStatusChipLabel,
  filterSessionsByQuery,
  partitionSessionsForBoard,
  type BoardSession,
} from "./sessionBoard";

function sess(overrides: Partial<BoardSession> & { id: string }): BoardSession {
  return {
    title: null,
    status: "idle",
    pending_elicitations_count: 0,
    archived: false,
    updated_at: 100,
    labels: {},
    ...overrides,
  };
}

describe("boardColumnForSession", () => {
  it("puts archived sessions in done even when running", () => {
    expect(
      boardColumnForSession(sess({ id: "a", archived: true, status: "running" })),
    ).toBe("done");
  });

  it("maps running / launching / waiting to running", () => {
    expect(boardColumnForSession(sess({ id: "r", status: "running" }))).toBe("running");
    expect(boardColumnForSession(sess({ id: "l", status: "launching" }))).toBe("running");
    expect(boardColumnForSession(sess({ id: "w", status: "waiting" }))).toBe("running");
  });

  it("maps idle and failed to waiting_for_you", () => {
    expect(boardColumnForSession(sess({ id: "i", status: "idle" }))).toBe("waiting_for_you");
    expect(boardColumnForSession(sess({ id: "f", status: "failed" }))).toBe("waiting_for_you");
  });
});

describe("boardStatusChip", () => {
  it("prefers needs_response over working status", () => {
    const chip = boardStatusChip(
      sess({ id: "n", status: "running", pending_elicitations_count: 2 }),
    );
    expect(chip).toEqual({ kind: "needs_response", count: 2 });
    expect(boardStatusChipLabel(chip)).toBe("Needs response (2)");
  });

  it("labels working and idle chips", () => {
    expect(boardStatusChipLabel(boardStatusChip(sess({ id: "r", status: "running" })))).toBe(
      "Working…",
    );
    expect(boardStatusChipLabel(boardStatusChip(sess({ id: "i", status: "idle" })))).toBe("Ready");
  });
});

describe("partitionSessionsForBoard", () => {
  it("buckets and sorts by updated_at desc within each column", () => {
    const rows = [
      sess({ id: "old-run", status: "running", updated_at: 10 }),
      sess({ id: "new-run", status: "running", updated_at: 50 }),
      sess({ id: "idle", status: "idle", updated_at: 40 }),
      sess({ id: "arch", archived: true, updated_at: 30 }),
    ];
    const buckets = partitionSessionsForBoard(rows);
    expect(buckets.running.map((s) => s.id)).toEqual(["new-run", "old-run"]);
    expect(buckets.waiting_for_you.map((s) => s.id)).toEqual(["idle"]);
    expect(buckets.done.map((s) => s.id)).toEqual(["arch"]);
  });
});

describe("filterSessionsByQuery", () => {
  it("filters by display label case-insensitively", () => {
    const rows = [
      sess({ id: "1", title: "Auth refactor" }),
      sess({ id: "2", title: "Docs pass" }),
    ];
    const filtered = filterSessionsByQuery(rows, "auth", (s) => s.title ?? s.id);
    expect(filtered.map((s) => s.id)).toEqual(["1"]);
  });
});
