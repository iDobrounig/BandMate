"use client";

import { useState, useTransition } from "react";
import { setAttendance } from "@/lib/actions/events";
import { ATTENDANCE_STATUS } from "@/lib/constants";
import type { AttendanceStatus } from "@/lib/db/schema";

const ORDER: AttendanceStatus[] = ["yes", "maybe", "no"];

export function AttendanceButtons({
  eventId,
  mine,
  myComment,
  withComment = false,
}: {
  eventId: number;
  mine: AttendanceStatus | null;
  myComment?: string | null;
  withComment?: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [comment, setComment] = useState(myComment ?? "");

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {ORDER.map((status) => {
          const meta = ATTENDANCE_STATUS[status];
          return (
            <button
              key={status}
              type="button"
              disabled={pending}
              onClick={() =>
                startTransition(() => setAttendance(eventId, status, comment))
              }
              className={`btn btn-sm ${mine === status ? meta.btnActive : ""}`}
            >
              {meta.symbol} {meta.label}
            </button>
          );
        })}
      </div>
      {withComment && (
        <input
          className="input max-w-xs py-1 text-sm"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          onBlur={() => {
            if (mine && comment !== (myComment ?? ""))
              startTransition(() => setAttendance(eventId, mine, comment));
          }}
          placeholder="Kommentar (z.B. komme später)"
          maxLength={200}
        />
      )}
    </div>
  );
}
