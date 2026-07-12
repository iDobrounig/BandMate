"use client";

import { useTransition } from "react";
import { setPracticeState } from "@/lib/actions/interactions";
import { PRACTICE_STATUS } from "@/lib/constants";
import type { PracticeState } from "@/lib/db/schema";

const ORDER: PracticeState[] = ["not_started", "practicing", "ready"];

export function PracticePicker({
  songId,
  mine,
}: {
  songId: number;
  mine: PracticeState;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex flex-wrap gap-2">
      {ORDER.map((status) => {
        const meta = PRACTICE_STATUS[status];
        const active = mine === status;
        return (
          <button
            key={status}
            type="button"
            disabled={pending}
            onClick={() => startTransition(() => setPracticeState(songId, status))}
            className={`btn btn-sm ${
              active ? "border-accent/70 bg-accent/15 text-accent-hi" : ""
            }`}
          >
            <span className={`size-2 rounded-full ${meta.color}`} />
            {meta.label}
          </button>
        );
      })}
    </div>
  );
}
