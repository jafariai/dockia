"use client";
import { useState } from "react";
import { Palette, Plus, Tags, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { apiErrorMessage } from "@/lib/api";
import {
  useCategories,
  useCreateCategory,
  useDeleteCategory,
  useUpdateCategory,
} from "@/lib/hooks";
import type { Category } from "@/lib/types";
import { useAuthStore } from "@/lib/auth-store";
import { AuthGuard } from "@/components/auth-guard";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { ColorPicker } from "@/components/ui/color-picker";

function CategoriesInner() {
  const isAdmin = useAuthStore((s) => s.user?.role === "admin");
  const { data: categories, isLoading } = useCategories();
  const create = useCreateCategory();
  const update = useUpdateCategory();
  const del = useDeleteCategory();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [color, setColor] = useState("#10b981");
  const [colorFor, setColorFor] = useState<Category | null>(null);
  const [colorValue, setColorValue] = useState("#10b981");

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    try {
      await create.mutateAsync({ name, color });
      toast.success("Category created");
      setName("");
      setColor("#10b981");
      setOpen(false);
    } catch (err) {
      toast.error(apiErrorMessage(err, "Could not create category"));
    }
  }

  function openColor(c: Category) {
    setColorFor(c);
    setColorValue(c.color);
  }

  async function saveColor() {
    if (!colorFor) return;
    try {
      await update.mutateAsync({ id: colorFor.id, color: colorValue });
      toast.success("Color updated");
      setColorFor(null);
    } catch (err) {
      toast.error(apiErrorMessage(err, "Could not update color"));
    }
  }

  async function onDeleteCategory(c: Category) {
    if (!confirm(`Delete category "${c.name}"?`)) return;
    try {
      await del.mutateAsync(c.id);
      toast.success("Category deleted");
    } catch (err) {
      // Backend returns a clear message if the category is still in use.
      toast.error(apiErrorMessage(err, "Could not delete category"));
    }
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Categories"
        description="Shared taxonomy applied to documents."
        action={
          isAdmin && (
            <Button onClick={() => setOpen(true)}>
              <Plus className="h-4 w-4" /> New category
            </Button>
          )
        }
      />

      {isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-20" />
          ))}
        </div>
      ) : !categories || categories.length === 0 ? (
        <EmptyState icon={Tags} title="No categories yet" />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {categories.map((c) => (
            <Card key={c.id}>
              <CardContent className="flex items-center justify-between gap-2 pt-6">
                <div className="flex min-w-0 items-center gap-2">
                  <span
                    className="h-3 w-3 shrink-0 rounded-full"
                    style={{ backgroundColor: c.color }}
                  />
                  <div className="min-w-0">
                    <p className="truncate font-medium">{c.name}</p>
                    <p className="text-xs text-muted-foreground">{c.slug}</p>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <span className="text-sm text-muted-foreground">
                    {c.document_count} docs
                  </span>
                  {isAdmin && (
                    <>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openColor(c)}
                        aria-label="Edit color"
                      >
                        <Palette className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => onDeleteCategory(c)}
                        disabled={del.isPending}
                        aria-label="Delete category"
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={open} onClose={() => setOpen(false)} title="New category">
        <form onSubmit={onCreate} className="space-y-4">
          <div className="space-y-1.5">
            <Label>Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div className="space-y-1.5">
            <Label>Color</Label>
            <ColorPicker value={color} onChange={setColor} />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={create.isPending}>
              Create
            </Button>
          </div>
        </form>
      </Dialog>

      <Dialog
        open={!!colorFor}
        onClose={() => setColorFor(null)}
        title={`Color · ${colorFor?.name ?? ""}`}
        description="Used in dashboard charts and labels."
      >
        <div className="space-y-4">
          <ColorPicker value={colorValue} onChange={setColorValue} />
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setColorFor(null)}>
              Cancel
            </Button>
            <Button onClick={saveColor} disabled={update.isPending}>
              Save
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}

export default function CategoriesPage() {
  return (
    <AuthGuard blockAudience>
      <CategoriesInner />
    </AuthGuard>
  );
}
