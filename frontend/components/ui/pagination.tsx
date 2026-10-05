"use client";
import { Button } from "./button";

/** Shared list pagination footer: "<count> <noun>s" + Previous/Next. */
export function Pagination({
  page,
  totalPages,
  count,
  noun = "item",
  onPrev,
  onNext,
}: {
  page: number;
  totalPages: number;
  count: number;
  noun?: string;
  onPrev: () => void;
  onNext: () => void;
}) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted-foreground">
        {count} {noun}
        {count === 1 ? "" : "s"}
      </span>
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" disabled={page <= 1} onClick={onPrev}>
          Previous
        </Button>
        <span className="text-muted-foreground">
          Page {page} of {totalPages}
        </span>
        <Button
          variant="outline"
          size="sm"
          disabled={page >= totalPages}
          onClick={onNext}
        >
          Next
        </Button>
      </div>
    </div>
  );
}
