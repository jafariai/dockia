"use client";
import { useState } from "react";
import Link from "next/link";
import { format } from "date-fns";
import { MessageSquareText, Plus, Search } from "lucide-react";
import { PromptFilters, useCategories, usePrompts, useProjects } from "@/lib/hooks";
import { useAuthStore } from "@/lib/auth-store";
import { PageHeader } from "@/components/page-header";
import { PromptFormDialog } from "@/components/prompt-form-dialog";
import { EmptyState } from "@/components/empty-state";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Pagination } from "@/components/ui/pagination";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";

const PAGE_SIZE = 20;

export default function PromptsPage() {
  const role = useAuthStore((s) => s.user?.role);
  const canCreate = role !== "audience"; // read-only viewers can't author prompts
  const [filters, setFilters] = useState<PromptFilters>({
    ordering: "-updated_at",
    page: 1,
  });
  const [searchInput, setSearchInput] = useState("");
  const [createOpen, setCreateOpen] = useState(false);

  const { data, isLoading } = usePrompts(filters);
  const { data: projects } = useProjects();
  const { data: categories } = useCategories();

  function update(patch: Partial<PromptFilters>) {
    setFilters((f) => ({ ...f, ...patch, page: 1 }));
  }

  const totalPages = data ? Math.max(1, Math.ceil(data.count / PAGE_SIZE)) : 1;
  const newButton = canCreate ? (
    <Button onClick={() => setCreateOpen(true)}>
      <Plus className="h-4 w-4" /> New prompt
    </Button>
  ) : undefined;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Prompts"
        description="Shared prompts and instructions for your team."
        action={newButton}
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
            placeholder="Search title, description, content…"
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
          icon={MessageSquareText}
          title="No prompts yet"
          description={
            canCreate
              ? "Create a prompt to share instructions with your team."
              : "No prompts in your projects yet."
          }
          action={newButton}
        />
      ) : (
        <>
          <div className="rounded-xl border border-border">
            <Table>
              <THead>
                <TR className="hover:bg-transparent">
                  <TH>Title</TH>
                  <TH>Project</TH>
                  <TH>Category</TH>
                  <TH>Owner</TH>
                  <TH>Updated</TH>
                </TR>
              </THead>
              <TBody>
                {data.results.map((p) => (
                  <TR key={p.id}>
                    <TD>
                      <Link
                        href={`/prompts/${p.id}`}
                        className="font-medium hover:underline"
                      >
                        {p.title}
                      </Link>
                      <div className="mt-0.5 flex flex-wrap gap-1">
                        {p.tags.slice(0, 3).map((t) => (
                          <Badge key={t} variant="outline" className="text-[10px]">
                            {t}
                          </Badge>
                        ))}
                      </div>
                    </TD>
                    <TD>
                      <Badge variant="secondary">{p.project_name}</Badge>
                    </TD>
                    <TD className="text-muted-foreground">{p.category_name}</TD>
                    <TD className="text-muted-foreground">{p.owner_email || "—"}</TD>
                    <TD className="text-muted-foreground">
                      {format(new Date(p.updated_at), "MMM d, yyyy")}
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
            noun="prompt"
            onPrev={() => setFilters((f) => ({ ...f, page: (f.page ?? 1) - 1 }))}
            onNext={() => setFilters((f) => ({ ...f, page: (f.page ?? 1) + 1 }))}
          />
        </>
      )}

      <PromptFormDialog open={createOpen} onClose={() => setCreateOpen(false)} />
    </div>
  );
}
