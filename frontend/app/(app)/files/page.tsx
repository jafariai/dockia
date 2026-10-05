"use client";
import { useEffect, useState } from "react";
import { format } from "date-fns";
import { Download, HardDrive, Loader2, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { apiErrorMessage, downloadStoredFile } from "@/lib/api";
import {
  FileFilters,
  useCategories,
  useDeleteFile,
  useFiles,
  useProjects,
} from "@/lib/hooks";
import { useAuthStore } from "@/lib/auth-store";
import { useNotifStore } from "@/lib/notif-store";
import { formatBytes } from "@/lib/utils";
import type { StoredFile } from "@/lib/types";
import { AuthGuard } from "@/components/auth-guard";
import { PageHeader } from "@/components/page-header";
import { FileUploadDialog } from "@/components/file-upload-dialog";
import { EmptyState } from "@/components/empty-state";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Pagination } from "@/components/ui/pagination";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";

const PAGE_SIZE = 20;

function FilesInner() {
  const isAdmin = useAuthStore((s) => s.user?.role === "admin");
  const [filters, setFilters] = useState<FileFilters>({
    ordering: "-created_at",
    page: 1,
  });
  const [searchInput, setSearchInput] = useState("");
  const [downloading, setDownloading] = useState<number | null>(null);

  const { data, isLoading } = useFiles(filters);
  const { data: projects } = useProjects();
  const { data: categories } = useCategories();

  // Viewing the list clears the "new files" nav badge.
  const markSeen = useNotifStore((s) => s.markSeen);
  useEffect(() => markSeen("files"), [markSeen]);
  const del = useDeleteFile();

  function update(patch: Partial<FileFilters>) {
    setFilters((f) => ({ ...f, ...patch, page: 1 }));
  }

  async function onDownload(f: StoredFile) {
    setDownloading(f.id);
    try {
      await downloadStoredFile(f.id);
    } catch (err) {
      toast.error(apiErrorMessage(err, "Download failed"));
    } finally {
      setDownloading(null);
    }
  }

  async function onDelete(f: StoredFile) {
    if (!confirm(`Delete "${f.name}" permanently?`)) return;
    try {
      await del.mutateAsync(f.id);
      toast.success("File deleted");
    } catch (err) {
      toast.error(apiErrorMessage(err, "Delete failed"));
    }
  }

  const totalPages = data ? Math.max(1, Math.ceil(data.count / PAGE_SIZE)) : 1;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Files"
        description="Store and download backups, assets and any other files."
        action={isAdmin ? <FileUploadDialog /> : undefined}
      />

      <div className="grid gap-3 rounded-xl border border-border bg-card/40 p-3 md:grid-cols-2 lg:grid-cols-4">
        <form
          className="relative lg:col-span-2"
          onSubmit={(e) => {
            e.preventDefault();
            update({ search: searchInput });
          }}
        >
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-8"
            placeholder="Search name, description, filename…"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
          />
        </form>

        <Select
          value={filters.project ?? ""}
          onChange={(e) =>
            update({ project: e.target.value ? Number(e.target.value) : undefined })
          }
        >
          <option value="">All projects</option>
          {(projects || []).map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </Select>

        <Select
          value={filters.category ?? ""}
          onChange={(e) =>
            update({ category: e.target.value ? Number(e.target.value) : undefined })
          }
        >
          <option value="">All categories</option>
          {(categories || []).map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-12" />
          ))}
        </div>
      ) : !data || data.results.length === 0 ? (
        <EmptyState
          icon={HardDrive}
          title="No files yet"
          description={
            isAdmin
              ? "Upload a backup or asset to get started."
              : "No files in your projects yet."
          }
          action={isAdmin ? <FileUploadDialog /> : undefined}
        />
      ) : (
        <>
          <div className="rounded-xl border border-border">
            <Table>
              <THead>
                <TR className="hover:bg-transparent">
                  <TH>Name</TH>
                  <TH>Project</TH>
                  <TH>Category</TH>
                  <TH>Owner</TH>
                  <TH>Size</TH>
                  <TH>Uploaded</TH>
                  <TH className="text-right">Actions</TH>
                </TR>
              </THead>
              <TBody>
                {data.results.map((f) => (
                  <TR key={f.id}>
                    <TD>
                      <p className="font-medium">{f.name}</p>
                      {f.original_filename && f.original_filename !== f.name && (
                        <p className="text-xs text-muted-foreground">
                          {f.original_filename}
                        </p>
                      )}
                    </TD>
                    <TD>
                      <Badge variant="secondary">{f.project_name}</Badge>
                    </TD>
                    <TD className="text-muted-foreground">{f.category_name}</TD>
                    <TD className="text-muted-foreground">{f.owner_email || "—"}</TD>
                    <TD className="text-muted-foreground">{formatBytes(f.size)}</TD>
                    <TD className="text-muted-foreground">
                      {format(new Date(f.created_at), "MMM d, yyyy")}
                    </TD>
                    <TD className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onDownload(f)}
                          disabled={downloading === f.id}
                        >
                          {downloading === f.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Download className="h-4 w-4" />
                          )}
                          Download
                        </Button>
                        {isAdmin && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onDelete(f)}
                            disabled={del.isPending}
                            aria-label="Delete file"
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        )}
                      </div>
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </div>

          <Pagination
            page={filters.page ?? 1}
            totalPages={totalPages}
            count={data.count}
            noun="file"
            onPrev={() => setFilters((f) => ({ ...f, page: (f.page ?? 1) - 1 }))}
            onNext={() => setFilters((f) => ({ ...f, page: (f.page ?? 1) + 1 }))}
          />
        </>
      )}
    </div>
  );
}

export default function FilesPage() {
  return (
    <AuthGuard blockAudience>
      <FilesInner />
    </AuthGuard>
  );
}
