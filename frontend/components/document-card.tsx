"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { format } from "date-fns";
import { Download, FileText, Zap } from "lucide-react";
import { toast } from "sonner";
import { downloadDocumentHtml } from "@/lib/api";
import { useDocumentPreview } from "@/lib/hooks";
import { previewSandbox } from "@/lib/utils";
import type { DocumentItem } from "@/lib/types";

// The thumbnail renders the real preview at a larger logical size, then scales
// it down — like a document snapshot. Kept lazy so a page of cards stays light.
const SCALE = 0.35;
// Past this, rendering a scaled iframe isn't worth the parse cost — show an icon.
const MAX_THUMB_CHARS = 600_000;

function ThumbShell({
  children,
  innerRef,
}: {
  children: React.ReactNode;
  innerRef?: React.Ref<HTMLDivElement>;
}) {
  return (
    <div
      ref={innerRef}
      className="relative flex h-40 w-full items-center justify-center overflow-hidden border-b border-border/60 bg-white"
    >
      {children}
    </div>
  );
}

function Thumbnail({ id, interactive }: { id: number; interactive: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  // Interactive docs can be multi-MB apps whose scripts would run on scroll;
  // don't fetch/render them as live thumbnails — show a static placeholder.
  // Only sanitized (script-free) docs get a live, cached preview.
  const wantsPreview = !interactive;

  // Render the preview only once the card scrolls near the viewport.
  useEffect(() => {
    if (!wantsPreview) return;
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setVisible(true);
          obs.disconnect();
        }
      },
      { rootMargin: "300px" }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [wantsPreview]);

  const { data: html, isError } = useDocumentPreview(id, wantsPreview && visible);

  if (interactive) {
    return (
      <ThumbShell>
        <div className="flex flex-col items-center gap-1 text-muted-foreground/50">
          <Zap className="h-8 w-8 text-amber-500/70" />
          <span className="text-xs">Interactive</span>
        </div>
      </ThumbShell>
    );
  }

  if (isError || (html && html.length > MAX_THUMB_CHARS)) {
    return (
      <ThumbShell innerRef={ref}>
        <FileText className="h-9 w-9 text-muted-foreground/30" />
      </ThumbShell>
    );
  }

  if (!html) {
    return (
      <ThumbShell innerRef={ref}>
        <div className="absolute inset-0 animate-pulse bg-muted/60" />
      </ThumbShell>
    );
  }

  return (
    <ThumbShell innerRef={ref}>
      <iframe
        aria-hidden
        tabIndex={-1}
        title=""
        sandbox={previewSandbox(false)}
        srcDoc={html}
        className="pointer-events-none absolute left-0 top-0 origin-top-left border-0"
        style={{
          width: `${100 / SCALE}%`,
          height: `${100 / SCALE}%`,
          transform: `scale(${SCALE})`,
          background: "white",
        }}
      />
    </ThumbShell>
  );
}

export function DocumentCard({
  doc,
  projectColor,
}: {
  doc: DocumentItem;
  projectColor?: string;
}) {
  async function onDownload() {
    try {
      await downloadDocumentHtml(doc.id, doc.title);
    } catch {
      toast.error("Download failed");
    }
  }

  return (
    <Link
      href={`/documents/${doc.id}`}
      className="group relative flex flex-col overflow-hidden rounded-xl border border-border/60 bg-card transition-all hover:-translate-y-0.5 hover:border-border hover:shadow-md"
    >
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onDownload();
        }}
        title="Download HTML"
        aria-label="Download document"
        className="absolute right-2 top-2 z-10 rounded-md border border-border bg-card/90 p-1.5 text-muted-foreground opacity-0 shadow-sm backdrop-blur transition hover:text-foreground group-hover:opacity-100"
      >
        <Download className="h-4 w-4" />
      </button>
      <Thumbnail id={doc.id} interactive={doc.render_mode === "interactive"} />
      <div className="space-y-2 p-3">
        <p className="line-clamp-2 min-h-[2.5rem] text-sm font-medium leading-snug">
          {doc.title}
        </p>
        <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
          <span className="flex min-w-0 items-center gap-1.5">
            <span
              className="h-2 w-2 shrink-0 rounded-full"
              style={{ backgroundColor: projectColor || "hsl(var(--muted-foreground))" }}
            />
            <span className="truncate">{doc.project_name}</span>
          </span>
          <span className="flex shrink-0 items-center gap-1">
            {doc.render_mode === "interactive" && (
              <Zap className="h-3 w-3 text-amber-500" />
            )}
            {format(new Date(doc.created_at), "MMM d")}
          </span>
        </div>
      </div>
    </Link>
  );
}
