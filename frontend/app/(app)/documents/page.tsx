"use client";
import { useEffect, useMemo, useState } from "react";
import { FileText, Search } from "lucide-react";
import {
  DocumentFilters,
  useCategories,
  useDocuments,
  useProjects,
  useUsers,
} from "@/lib/hooks";
import { useAuthStore } from "@/lib/auth-store";
import { useNotifStore } from "@/lib/notif-store";
import { PageHeader } from "@/components/page-header";
import { UploadDialog } from "@/components/upload-dialog";
import { EmptyState } from "@/components/empty-state";
import { DocumentCard } from "@/components/document-card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Pagination } from "@/components/ui/pagination";

const PAGE_SIZE = 20;

export default function DocumentsPage() {
  const role = useAuthStore((s) => s.user?.role);
  const isAdmin = role === "admin";
  const canUpload = role !== "audience"; // read-only viewers can't upload
  const [filters, setFilters] = useState<DocumentFilters>({
    ordering: "-created_at",
    page: 1,
  });
  const [searchInput, setSearchInput] = useState("");

  const { data, isLoading } = useDocuments(filters);
  const { data: projects } = useProjects();
  const { data: categories } = useCategories();
  const { data: users } = useUsers(isAdmin); // owner filter is admin-only

  // Viewing the list clears the "new documents" nav badge.
  const markSeen = useNotifStore((s) => s.markSeen);
  useEffect(() => markSeen("documents"), [markSeen]);

  function update(patch: Partial<DocumentFilters>) {
    setFilters((f) => ({ ...f, ...patch, page: 1 }));
  }

  const totalPages = data ? Math.max(1, Math.ceil(data.count / PAGE_SIZE)) : 1;
  const projectColor = useMemo(
    () => new Map((projects || []).map((p) => [p.id, p.color])),
    [projects]
  );

  return (
    <div className="space-y-5">
      <PageHeader
        title="Documents"
        description="Browse, filter and preview internal HTML documentation."
        action={canUpload ? <UploadDialog /> : undefined}
      />

      <div className="grid gap-3 rounded-xl border border-border bg-card/40 p-3 md:grid-cols-2 lg:grid-cols-5">
        <form
          className="relative md:col-span-2 lg:col-span-2"
          onSubmit={(e) => {
            e.preventDefault();
            update({ search: searchInput });
          }}
        >
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-8"
            placeholder="Search title, description, tags…"
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

        <Select
          value={filters.date ?? ""}
          onChange={(e) => update({ date: e.target.value || undefined })}
        >
          <option value="">Any time</option>
          <option value="today">Today</option>
          <option value="7d">Last 7 days</option>
          <option value="30d">Last 30 days</option>
        </Select>

        {isAdmin && (
          <Select
            value={filters.owner ?? ""}
            onChange={(e) =>
              update({ owner: e.target.value ? Number(e.target.value) : undefined })
            }
          >
            <option value="">All owners</option>
            {(users || []).map((u) => (
              <option key={u.id} value={u.id}>
                {u.email}
              </option>
            ))}
          </Select>
        )}

        <Select
          value={filters.ordering ?? "-created_at"}
          onChange={(e) => update({ ordering: e.target.value })}
        >
          <option value="-created_at">Newest first</option>
          <option value="created_at">Oldest first</option>
          <option value="title">Title A→Z</option>
          <option value="-title">Title Z→A</option>
        </Select>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="text-muted-foreground">Custom range:</span>
        <Input
          type="date"
          className="w-auto"
          value={filters.created_after ?? ""}
          onChange={(e) => update({ created_after: e.target.value || undefined })}
        />
        <span className="text-muted-foreground">→</span>
        <Input
          type="date"
          className="w-auto"
          value={filters.created_before ?? ""}
          onChange={(e) => update({ created_before: e.target.value || undefined })}
        />
      </div>

      {/* Results — soft card grid, 4 per row on wide screens */}
      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-60 rounded-xl" />
          ))}
        </div>
      ) : !data || data.results.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="No documents found"
          description={
            canUpload
              ? "Try adjusting filters, or upload a new HTML document."
              : "Try adjusting filters."
          }
          action={canUpload ? <UploadDialog /> : undefined}
        />
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {data.results.map((doc) => (
              <DocumentCard
                key={doc.id}
                doc={doc}
                projectColor={projectColor.get(doc.project)}
              />
            ))}
          </div>

          <Pagination
            page={filters.page ?? 1}
            totalPages={totalPages}
            count={data.count}
            noun="document"
            onPrev={() => setFilters((f) => ({ ...f, page: (f.page ?? 1) - 1 }))}
            onNext={() => setFilters((f) => ({ ...f, page: (f.page ?? 1) + 1 }))}
          />
        </>
      )}
    </div>
  );
}
