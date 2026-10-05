"use client";
import { useRef, useState } from "react";
import { UploadCloud, X } from "lucide-react";
import { cn, formatBytes } from "@/lib/utils";

/** Click-to-browse + drag-and-drop file picker. Controlled via `file`/`onFile`. */
export function Dropzone({
  file,
  onFile,
  accept,
  hint,
}: {
  file: File | null;
  onFile: (f: File | null) => void;
  accept?: string;
  hint?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);

  function pick(files: FileList | null) {
    const f = files && files[0];
    if (f) onFile(f);
  }

  return (
    <div>
      <div
        role="button"
        tabIndex={0}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") inputRef.current?.click();
        }}
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          pick(e.dataTransfer.files);
        }}
        className={cn(
          "flex cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed px-4 py-6 text-center transition-colors",
          over ? "border-primary bg-primary/5" : "border-border hover:bg-accent/50"
        )}
      >
        <UploadCloud className="h-6 w-6 text-muted-foreground" />
        {file ? (
          <p className="text-sm font-medium">
            {file.name} · {formatBytes(file.size)}
          </p>
        ) : (
          <>
            <p className="text-sm">
              <span className="font-medium text-foreground">Click to choose</span> or
              drag &amp; drop
            </p>
            {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
          </>
        )}
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          className="hidden"
          onChange={(e) => pick(e.target.files)}
        />
      </div>
      {file && (
        <button
          type="button"
          onClick={() => onFile(null)}
          className="mt-1 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <X className="h-3 w-3" /> Remove
        </button>
      )}
    </div>
  );
}
