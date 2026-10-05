"use client";
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { fetchPreviewHtml } from "@/lib/api";
import { previewSandbox } from "@/lib/utils";

/**
 * Renders document HTML inside a locked-down iframe.
 *
 * Defense in depth:
 *  - Sanitized mode: scripts/handlers were stripped server-side AND the sandbox
 *    has no allow-scripts — nothing can execute.
 *  - Interactive mode: the original scripts run, but `allow-same-origin` is
 *    STILL omitted, so the frame is a unique opaque origin. Even active JS
 *    cannot read the parent, cookies, localStorage, or the JWT; an injected
 *    `connect-src 'none'` CSP blocks network exfiltration.
 *  - Content is delivered as a client-side `blob:` URL (never a server fetch),
 *    so there is no authenticated top-level navigation to raw content.
 *
 * Why a blob URL and not `srcdoc`: a `srcdoc` document inherits the PARENT's
 * base URL, so an in-document table-of-contents link (`<a href="#section">`)
 * resolves to the app route (…/documents/9/preview#section) and navigates the
 * iframe there → a blank page. A blob URL is the document's own base, so
 * `#section` links stay in-document and scroll correctly.
 */
export function HtmlPreview({
  id,
  interactive = false,
  className,
}: {
  id: number;
  interactive?: boolean;
  className?: string;
}) {
  const [html, setHtml] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setHtml(null);
    setError(null);
    fetchPreviewHtml(id)
      .then((h) => active && setHtml(h))
      .catch(() => active && setError("Unable to load preview."));
    return () => {
      active = false;
    };
  }, [id]);

  // Turn the fetched HTML into a blob: URL so in-document #anchors resolve
  // against the document itself (see note above). Revoked on change/unmount.
  useEffect(() => {
    if (html === null) {
      setSrc(null);
      return;
    }
    const url = URL.createObjectURL(new Blob([html], { type: "text/html" }));
    setSrc(url);
    return () => URL.revokeObjectURL(url);
  }, [html]);

  if (error)
    return (
      <div className="flex h-full items-center justify-center text-sm text-destructive">
        {error}
      </div>
    );
  if (src === null)
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );

  return (
    <iframe
      title="Document preview"
      sandbox={previewSandbox(interactive)}
      src={src}
      className={className}
      style={{ background: "white" }}
    />
  );
}
