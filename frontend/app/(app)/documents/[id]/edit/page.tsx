"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import CodeMirror from "@uiw/react-codemirror";
import { html as htmlLang } from "@codemirror/lang-html";
import { useTheme } from "next-themes";
import { ArrowLeft, Code, Eye, Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import { apiErrorMessage } from "@/lib/api";
import { cn, previewSandbox } from "@/lib/utils";
import { useDocument, useDocumentRaw, useSaveDocumentHtml } from "@/lib/hooks";
import { useAuthStore } from "@/lib/auth-store";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

export default function DocumentEditPage({ params }: { params: { id: string } }) {
  const docId = Number(params.id);
  const router = useRouter();
  const { resolvedTheme } = useTheme();
  const { data: doc } = useDocument(docId);
  const { data: raw, isLoading } = useDocumentRaw(docId);
  const save = useSaveDocumentHtml();
  const user = useAuthStore((s) => s.user);

  const [value, setValue] = useState<string>("");
  const [dirty, setDirty] = useState(false);
  // Debounced copy that feeds the live preview, so typing stays smooth.
  const [previewHtml, setPreviewHtml] = useState<string>("");
  // Below lg, the two panels become tabs instead of stacking (mobile-first).
  const [mobileTab, setMobileTab] = useState<"code" | "preview">("code");

  // Seed the editor once the source arrives.
  useEffect(() => {
    if (raw) {
      setValue(raw.html);
      setPreviewHtml(raw.html);
      setDirty(false);
    }
  }, [raw]);

  // Debounce preview updates (250ms) to avoid re-rendering the iframe per keystroke.
  useEffect(() => {
    const t = setTimeout(() => setPreviewHtml(value), 250);
    return () => clearTimeout(t);
  }, [value]);

  // Warn before leaving with unsaved edits.
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (dirty) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  const interactive = doc?.render_mode === "interactive";
  const canManage =
    user?.role === "admin" || (doc && doc.owner === user?.id);

  const extensions = useMemo(() => [htmlLang()], []);

  async function onSave() {
    try {
      await save.mutateAsync({ id: docId, html: value });
      setDirty(false);
      toast.success("Saved — preview re-sanitized");
    } catch (err) {
      toast.error(apiErrorMessage(err, "Save failed"));
    }
  }

  if (isLoading || !doc) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-[600px]" />
      </div>
    );
  }

  if (!canManage) {
    return (
      <div className="space-y-4">
        <Link
          href={`/documents/${docId}`}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Back
        </Link>
        <p className="text-sm text-destructive">
          You don&apos;t have permission to edit this document.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <Link
            href={`/documents/${docId}`}
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" /> Back to document
          </Link>
          <h1 className="mt-1 flex items-center gap-2 text-xl font-semibold tracking-tight">
            <span className="truncate">Editing: {doc.title}</span>
            <Badge variant={interactive ? "default" : "secondary"}>
              {interactive ? "Interactive" : "Sanitized"}
            </Badge>
            {dirty && <span className="text-xs text-amber-500">● unsaved</span>}
          </h1>
        </div>
        <div className="flex gap-2">
          <Link href={`/documents/${docId}/preview`}>
            <Button variant="outline">
              <Eye className="h-4 w-4" /> Full preview
            </Button>
          </Link>
          <Button onClick={onSave} disabled={save.isPending || !dirty}>
            {save.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            Save
          </Button>
        </div>
      </div>

      {/* Mobile tab switcher — hidden on lg where both panels show side by side. */}
      <div className="flex gap-1 rounded-lg border border-border p-1 lg:hidden">
        <button
          type="button"
          onClick={() => setMobileTab("code")}
          className={cn(
            "flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
            mobileTab === "code"
              ? "bg-secondary text-foreground"
              : "text-muted-foreground"
          )}
        >
          <Code className="h-4 w-4" /> Code
        </button>
        <button
          type="button"
          onClick={() => setMobileTab("preview")}
          className={cn(
            "flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
            mobileTab === "preview"
              ? "bg-secondary text-foreground"
              : "text-muted-foreground"
          )}
        >
          <Eye className="h-4 w-4" /> Preview
        </button>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Code editor — shown when the Code tab is active, always on lg. */}
        <div
          className={cn(
            "overflow-hidden rounded-lg border border-border lg:block",
            mobileTab === "code" ? "block" : "hidden"
          )}
        >
          <div className="border-b border-border bg-muted/40 px-3 py-1.5 text-xs font-medium text-muted-foreground">
            HTML source
          </div>
          <CodeMirror
            value={value}
            height="600px"
            theme={resolvedTheme === "dark" ? "dark" : "light"}
            extensions={extensions}
            onChange={(v) => {
              setValue(v);
              setDirty(true);
            }}
          />
        </div>

        {/* Live preview — shown when the Preview tab is active, always on lg. */}
        <div
          className={cn(
            "overflow-hidden rounded-lg border border-border lg:block",
            mobileTab === "preview" ? "block" : "hidden"
          )}
        >
          <div className="border-b border-border bg-muted/40 px-3 py-1.5 text-xs font-medium text-muted-foreground">
            Live preview {interactive ? "(scripts run)" : "(static)"}
          </div>
          <iframe
            title="Live preview"
            sandbox={previewSandbox(interactive)}
            srcDoc={previewHtml}
            style={{ height: 600, width: "100%", background: "white" }}
          />
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        The live preview renders your unsaved HTML locally. On save, the server
        re-sanitizes the document so the public preview stays safe.
      </p>
    </div>
  );
}
