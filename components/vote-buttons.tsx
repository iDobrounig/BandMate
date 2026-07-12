"use client";

import { useTransition } from "react";
import { setVote } from "@/lib/actions/interactions";

export function VoteButtons({
  songId,
  myVote,
  upvoters,
  downvoters,
}: {
  songId: number;
  myVote: number;
  upvoters: string[];
  downvoters: string[];
}) {
  const [pending, startTransition] = useTransition();

  const vote = (value: 1 | -1) =>
    startTransition(() => setVote(songId, myVote === value ? 0 : value));

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        disabled={pending}
        onClick={() => vote(1)}
        title={upvoters.length ? `Dafür: ${upvoters.join(", ")}` : "Dafür stimmen"}
        className={`btn ${
          myVote === 1
            ? "border-emerald-500/60 bg-emerald-500/15 text-emerald-300"
            : ""
        }`}
      >
        👍 <span className="mono-display">{upvoters.length}</span>
      </button>
      <button
        type="button"
        disabled={pending}
        onClick={() => vote(-1)}
        title={
          downvoters.length ? `Dagegen: ${downvoters.join(", ")}` : "Dagegen stimmen"
        }
        className={`btn ${
          myVote === -1 ? "border-red-500/60 bg-red-500/15 text-red-300" : ""
        }`}
      >
        👎 <span className="mono-display">{downvoters.length}</span>
      </button>
    </div>
  );
}
