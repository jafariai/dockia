"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import {
  ArrowLeft,
  Download,
  Eye,
  Loader2,
  Pencil,
  ShieldCheck,
  Trash2,
  UploadCloud,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import { apiErrorMessage, downloadDocumentHtml } from "@/lib/api";
import {
  useDeleteDocument,
  useDocument,
  useProjectLinks,
  useReplaceDocumentFile,
  useUpdateDocument,
} from "@/lib/hooks";
import { useAuthStore } from "@/lib/auth-store";
import { formatBytes } from "@/lib/utils";
import { ProjectLinks } from "@/components/project-links";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { Dropzone } from "@/components/ui/dropzone";
import { Skeleton } from "@/components/ui/skeleton";
import { HtmlPreview } from "@/components/html-preview";

export default function DocumentDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const docId = Number(params.id);
  const router = useRouter();
  const { data: doc, isLoading } = useDocument(docId);
  const del = useDeleteDocument();
  const user = useAuthStore((s) => s.user);
  const update = useUpdateDocument();
  const replaceFile = useReplaceDocumentFile();
  const { data: projectLinks } = useProjectLinks(doc?.project);
  const canManage = user?.role === "admin" || (doc && doc.owner === user?.id);

  const [updateOpen, setUpdateOpen] = useState(false);
  const [newFile, setNewFile] = useState<File | null>(null);

  async function onReplaceFile(e: React.FormEvent) {
    e.preventDefault();
    if (!newFile) return;
    try {
      await replaceFile.mutateAsync({ id: docId, file: newFile });
      toast.success("Document updated from the new file");
      setUpdateOpen(false);
      setNewFile(null);
    } catch (err) {
      toast.error(apiErrorMessage(err, "Update failed"));
    }
  }

  async function toggleMode() {
    if (!doc) return;
    const next = doc.render_mode === "interactive" ? "sanitized" : "interactive";
    try {
      await update.mutateAsync({ id: doc.id, data: { render_mode: next } });
      toast.success(
        next === "interactive"
          ? "Interactive mode on — scripts run in an isolated sandbox"
          : "Sanitized mode on — scripts stripped"
      );
    } catch (err) {
      toast.error(apiErrorMessage(err, "Could not change mode"));
    }
  }

  async function onDownload() {
    if (!doc) return;
    try {
      await downloadDocumentHtml(doc.id, doc.title);
    } catch (err) {
      toast.error(apiErrorMessage(err, "Download failed"));
    }
  }

  async function onDelete() {
    if (!confirm("Delete this document permanently?")) return;
    try {
      await del.mutateAsync(docId);
      toast.success("Document deleted");
      router.replace("/documents");
    } catch (err) {
      toast.error(apiErrorMessage(err, "Delete failed"));
    }
  }

  if (isLoading || !doc) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-96" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <Link
        href="/documents"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Back to documents
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{doc.title}</h1>
          {doc.description && (
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
              {doc.description}
            </p>
          )}
        </div>
        <div className="flex gap-2">
          {canManage && (
            <Button
              variant="outline"
              onClick={toggleMode}
              disabled={update.isPending}
              title="Sanitized strips all scripts; Interactive runs them in an isolated sandbox"
            >
              {doc.render_mode === "interactive" ? (
                <>
                  <Zap className="h-4 w-4" /> Interactive
                </>
              ) : (
                <>
                  <ShieldCheck className="h-4 w-4" /> Sanitized
                </>
              )}
            </Button>
          )}
          {canManage && (
            <Link href={`/documents/${doc.id}/edit`}>
              <Button variant="outline">
                <Pencil className="h-4 w-4" /> Edit HTML
              </Button>
            </Link>
          )}
          {canManage && (
            <Button variant="outline" onClick={() => setUpdateOpen(true)}>
              <UploadCloud className="h-4 w-4" /> Update
            </Button>
          )}
          <Button variant="outline" onClick={onDownload}>
            <Download className="h-4 w-4" /> Download
          </Button>
          <Link href={`/documents/${doc.id}/preview`}>
            <Button>
              <Eye className="h-4 w-4" /> Open preview
            </Button>
          </Link>
          {canManage && (
            <Button variant="destructive" onClick={onDelete} disabled={del.isPending}>
              <Trash2 className="h-4 w-4" /> Delete
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <Card className="lg:col-span-2 overflow-hidden">
          <CardHeader>
            <CardTitle>Preview</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <HtmlPreview
              id={doc.id}
              interactive={doc.render_mode === "interactive"}
              className="h-[520px] w-full border-t border-border"
            />
          </CardContent>
        </Card>

        <div className="space-y-5">
        <Card>
          <CardHeader>
            <CardTitle>Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <Field label="Project" value={<Badge variant="secondary">{doc.project_name}</Badge>} />
            <Field label="Category" value={doc.category_name} />
            <Field label="Owner" value={doc.owner_email || "—"} />
            <Field label="File size" value={formatBytes(doc.file_size)} />
            <Field
              label="Created"
              value={format(new Date(doc.created_at), "PPpp")}
            />
            <Field
              label="Updated"
              value={format(new Date(doc.updated_at), "PPpp")}
            />
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
          </CardContent>
        </Card>

        {projectLinks && projectLinks.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Project links</CardTitle>
            </CardHeader>
            <CardContent>
              <ProjectLinks links={projectLinks} />
            </CardContent>
          </Card>
        )}
        </div>
      </div>

      {/* Update document from a new file (drag & drop) */}
      <Dialog
        open={updateOpen}
        onClose={() => {
          setUpdateOpen(false);
          setNewFile(null);
        }}
        title="Update document"
        description="Drag in a new version of the HTML file. It replaces the current content and is re-sanitized on save."
      >
        <form onSubmit={onReplaceFile} className="space-y-4">
          <Dropzone
            file={newFile}
            onFile={setNewFile}
            accept=".html,.htm"
            hint="Drop the new .html or .htm file here"
          />
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setUpdateOpen(false);
                setNewFile(null);
              }}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={!newFile || replaceFile.isPending}>
              {replaceFile.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <UploadCloud className="h-4 w-4" />
              )}
              Update document
            </Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{value}</span>
    </div>
  );
}
