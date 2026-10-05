"use client";
import { cn } from "@/lib/utils";

export const COLOR_PRESETS = [
  "#6366f1", "#10b981", "#f59e0b", "#ef4444", "#3b82f6",
  "#8b5cf6", "#ec4899", "#14b8a6", "#64748b", "#0f172a",
];

/** Swatch grid + native picker for choosing a hex color. */
export function ColorPicker({
  value,
  onChange,
}: {
  value: string | null | undefined;
  onChange: (color: string) => void;
}) {
  // Tolerate missing/legacy values so the picker never crashes.
  const current = value || COLOR_PRESETS[0];
  return (
    <div className="flex flex-wrap items-center gap-2">
      {COLOR_PRESETS.map((c) => (
        <button
          key={c}
          type="button"
          onClick={() => onChange(c)}
          aria-label={`Use ${c}`}
          className={cn(
            "h-7 w-7 rounded-full border border-border transition",
            current.toLowerCase() === c.toLowerCase() &&
              "ring-2 ring-ring ring-offset-2 ring-offset-background"
          )}
          style={{ backgroundColor: c }}
        />
      ))}
      {/* Custom color */}
      <label className="ml-1 inline-flex h-7 cursor-pointer items-center gap-1.5 rounded-md border border-border px-2 text-xs text-muted-foreground">
        <span
          className="h-4 w-4 rounded-full border border-border"
          style={{ backgroundColor: current }}
        />
        Custom
        <input
          type="color"
          value={current}
          onChange={(e) => onChange(e.target.value)}
          className="sr-only"
        />
      </label>
    </div>
  );
}
