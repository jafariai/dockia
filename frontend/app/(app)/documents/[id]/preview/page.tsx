"use client";
import { useState } from "react";
import Link from "next/link";
import { format } from "date-fns";
import { ArrowLeft, Info, Maximize2, Minimize2, PanelRightClose } from "lucide-react";
import { useDocument } from "@/lib/hooks";
import { formatBytes } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { HtmlPreview } from "@/components/html-preview";
import { cn } from "@/lib/utils";

export default function PreviewPage({
  params,
}: {
  params: { id: string };
}) {
  const docId = Number(params.id);
  const { data: doc, isLoading } = useDocument(docId);
  const [fullscreen, setFullscreen] = useState(false);
  const [showInfo, setShowInfo] = useState(true);

  if (isLoading || !doc) {
    return <Skeleton className="h-[80vh] w-full" />;
  }

  return (
    <div
      className={cn(
        "flex flex-col",
        fullscreen
          ? "fixed inset-0 z-50 bg-background p-3"
          : "h-[calc(100vh-7rem)]"
      )}
    >
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          <Link
            href={`/documents/${doc.id}`}
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" /> Back
          </Link>
          <h1 className="truncate text-lg font-semibold">{doc.title}</h1>
          <Badge variant="secondary">{doc.project_name}</Badge>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowInfo((v) => !v)}>
            {showInfo ? (
              <PanelRightClose className="h-4 w-4" />
            ) : (
              <Info className="h-4 w-4" />
            )}
            {showInfo ? "Hide info" : "Info"}
          </Button>
          <Button variant="outline" size="sm" onClick={() => setFullscreen((v) => !v)}>
            {fullscreen ? (
              <Minimize2 className="h-4 w-4" />
            ) : (
              <Maximize2 className="h-4 w-4" />
            )}
            {fullscreen ? "Exit" : "Full screen"}
          </Button>
          {/* Opens the standalone viewer in a new tab. We deliberately link to
              the SPA route (not the raw API URL) because the bearer token can't
              ride a top-level navigation; the new tab re-hydrates auth from the
              shared refresh token. */}
          <a href={`/documents/${doc.id}/preview`} target="_blank" rel="noopener noreferrer">
            <Button variant="outline" size="sm">
              Open in new tab
            </Button>
          </a>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 gap-3">
        <div className="min-h-0 flex-1 overflow-hidden rounded-xl border border-border">
          <HtmlPreview
            id={doc.id}
            interactive={doc.render_mode === "interactive"}
            className="h-full w-full"
          />
        </div>

        {showInfo && (
          <aside className="hidden w-72 shrink-0 space-y-3 overflow-y-auto rounded-xl border border-border bg-card/40 p-4 text-sm lg:block">
            <h2 className="font-semibold">Document information</h2>
            <Row label="Project" value={doc.project_name} />
            <Row label="Category" value={doc.category_name} />
            <Row label="Owner" value={doc.owner_email || "—"} />
            <Row label="Size" value={formatBytes(doc.file_size)} />
            <Row label="Created" value={format(new Date(doc.created_at), "PPp")} />
            <Row label="Updated" value={format(new Date(doc.updated_at), "PPp")} />
            {doc.description && (
              <div>
                <p className="mb-1 text-muted-foreground">Description</p>
                <p>{doc.description}</p>
              </div>
            )}
            <div>
              <p className="mb-1 text-muted-foreground">Tags</p>
              <div className="flex flex-wrap gap-1">
                {doc.tags.length ? (
                  doc.tags.map((t) => (
                    <Badge key={t} variant="outline">
                      {t}
                    </Badge>
                  ))
                ) : (
                  <span className="text-muted-foreground">None</span>
                )}
              </div>
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{value}</span>
    </div>
  );
}
