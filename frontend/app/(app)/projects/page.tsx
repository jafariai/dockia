"use client";
import { useState } from "react";
import {
  Archive,
  ArchiveRestore,
  FolderKanban,
  Link2,
  Palette,
  Plus,
  Trash2,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { apiErrorMessage } from "@/lib/api";
import {
  useArchiveProject,
  useAssignMembers,
  useCreateProject,
  useCreateProjectLink,
  useDeleteProject,
  useDeleteProjectLink,
  useProjects,
  useUnarchiveProject,
  useUpdateProject,
  useUsers,
} from "@/lib/hooks";
import type { LinkType } from "@/lib/types";
import { useAuthStore } from "@/lib/auth-store";
import type { Project } from "@/lib/types";
import { AuthGuard } from "@/components/auth-guard";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { ColorPicker } from "@/components/ui/color-picker";
import {
  LINK_TYPE_GROUPS,
  ProjectLinks,
  linkIcon,
  linkTypeLabel,
} from "@/components/project-links";

function ProjectsInner() {
  const isAdmin = useAuthStore((s) => s.user?.role === "admin");
  const { data: projects, isLoading } = useProjects();
  const { data: users } = useUsers(isAdmin); // only needed for the admin members dialog
  const create = useCreateProject();
  const update = useUpdateProject();
  const archive = useArchiveProject();
  const unarchive = useUnarchiveProject();
  const del = useDeleteProject();
  const assign = useAssignMembers();
  const createLink = useCreateProjectLink();
  const deleteLink = useDeleteProjectLink();

  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [color, setColor] = useState("#6366f1");
  const [memberFor, setMemberFor] = useState<Project | null>(null);
  const [selected, setSelected] = useState<number[]>([]);
  const [colorFor, setColorFor] = useState<Project | null>(null);
  const [colorValue, setColorValue] = useState("#6366f1");
  const [linksForId, setLinksForId] = useState<number | null>(null);
  const [linkType, setLinkType] = useState<LinkType>("figma");
  const [linkLabel, setLinkLabel] = useState("");
  const [linkUrl, setLinkUrl] = useState("");

  // The live project whose links dialog is open (so the list updates on change).
  const linksProject = (projects || []).find((p) => p.id === linksForId) || null;

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    try {
      await create.mutateAsync({ name, description, color });
      toast.success("Project created");
      setName("");
      setDescription("");
      setColor("#6366f1");
      setCreateOpen(false);
    } catch (err) {
      toast.error(apiErrorMessage(err, "Could not create project"));
    }
  }

  function openColor(p: Project) {
    setColorFor(p);
    setColorValue(p.color);
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

  function openLinks(p: Project) {
    setLinksForId(p.id);
    setLinkType("figma");
    setLinkLabel("");
    setLinkUrl("");
  }

  async function addLink(e: React.FormEvent) {
    e.preventDefault();
    if (!linksForId) return;
    try {
      await createLink.mutateAsync({
        project: linksForId,
        label: linkLabel,
        url: linkUrl,
        link_type: linkType,
      });
      setLinkLabel("");
      setLinkUrl("");
      toast.success("Link added");
    } catch (err) {
      toast.error(apiErrorMessage(err, "Could not add link"));
    }
  }

  async function removeLink(id: number) {
    try {
      await deleteLink.mutateAsync(id);
      toast.success("Link removed");
    } catch (err) {
      toast.error(apiErrorMessage(err, "Could not remove link"));
    }
  }

  async function onDeleteProject(p: Project) {
    if (
      !confirm(
        `Delete project "${p.name}"?\n\nThis permanently removes the project and ALL its documents, files, and prompts. This cannot be undone.`
      )
    )
      return;
    try {
      await del.mutateAsync(p.id);
      toast.success("Project deleted");
    } catch (err) {
      toast.error(apiErrorMessage(err, "Could not delete project"));
    }
  }

  function openMembers(p: Project) {
    setMemberFor(p);
    setSelected(p.member_ids);
  }

  async function saveMembers() {
    if (!memberFor) return;
    try {
      await assign.mutateAsync({ id: memberFor.id, user_ids: selected });
      toast.success("Members updated");
      setMemberFor(null);
    } catch (err) {
      toast.error(apiErrorMessage(err));
    }
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Projects"
        description="Group documentation by area of work."
        action={
          isAdmin && (
            <Button onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4" /> New project
            </Button>
          )
        }
      />

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-36" />
          ))}
        </div>
      ) : !projects || projects.length === 0 ? (
        <EmptyState icon={FolderKanban} title="No projects yet" />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((p) => (
            <Card key={p.id}>
              <CardHeader>
                <CardTitle className="flex items-center justify-between gap-2">
                  <span className="flex min-w-0 items-center gap-2">
                    <span
                      className="h-3 w-3 shrink-0 rounded-full"
                      style={{ backgroundColor: p.color }}
                    />
                    <span className="truncate">{p.name}</span>
                  </span>
                  {p.is_archived && <Badge variant="outline">Archived</Badge>}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="line-clamp-2 text-sm text-muted-foreground">
                  {p.description || "No description."}
                </p>
                <div className="flex items-center gap-3 text-sm text-muted-foreground">
                  <span>{p.document_count} docs</span>
                  <span>·</span>
                  <span>{p.member_ids.length} members</span>
                </div>
                {p.links.length > 0 && <ProjectLinks links={p.links} />}
                {isAdmin && (
                  <div className="flex flex-wrap gap-2">
                    <Button variant="outline" size="sm" onClick={() => openMembers(p)}>
                      <Users className="h-4 w-4" /> Members
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => openLinks(p)}>
                      <Link2 className="h-4 w-4" /> Links
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => openColor(p)}>
                      <Palette className="h-4 w-4" /> Color
                    </Button>
                    {p.is_archived ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => unarchive.mutate(p.id)}
                      >
                        <ArchiveRestore className="h-4 w-4" /> Unarchive
                      </Button>
                    ) : (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => archive.mutate(p.id)}
                      >
                        <Archive className="h-4 w-4" /> Archive
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onDeleteProject(p)}
                      disabled={del.isPending}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" /> Delete
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create dialog */}
      <Dialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="New project"
      >
        <form onSubmit={onCreate} className="space-y-4">
          <div className="space-y-1.5">
            <Label>Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div className="space-y-1.5">
            <Label>Description</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Color</Label>
            <ColorPicker value={color} onChange={setColor} />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={create.isPending}>
              Create
            </Button>
          </div>
        </form>
      </Dialog>

      {/* Color dialog */}
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

      {/* Links dialog */}
      <Dialog
        open={!!linksProject}
        onClose={() => setLinksForId(null)}
        title={`Links · ${linksProject?.name ?? ""}`}
        description="Figma, Linear, repos and other references for this project."
      >
        <div className="space-y-4">
          {linksProject && linksProject.links.length > 0 ? (
            <ul className="divide-y divide-border rounded-lg border border-border">
              {linksProject.links.map((l) => {
                const Icon = linkIcon(l.link_type);
                return (
                  <li key={l.id} className="flex items-center gap-2 px-3 py-2 text-sm">
                    <Icon className="h-4 w-4 shrink-0" />
                    <a
                      href={l.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="min-w-0 flex-1 truncate hover:underline"
                      title={l.url}
                    >
                      {l.label}
                    </a>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeLink(l.id)}
                      aria-label="Remove link"
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">No links yet.</p>
          )}

          <form onSubmit={addLink} className="space-y-3 border-t border-border pt-4">
            <div className="grid grid-cols-3 gap-2">
              <div className="space-y-1.5">
                <Label>Type</Label>
                <Select
                  value={linkType}
                  onChange={(e) => {
                    const v = e.target.value;
                    setLinkType(v);
                    // Prefill the label with the service name if still empty.
                    if (!linkLabel) setLinkLabel(linkTypeLabel(v));
                  }}
                >
                  {LINK_TYPE_GROUPS.map((g) => (
                    <optgroup key={g.group} label={g.group}>
                      {g.items.map((t) => (
                        <option key={t.value} value={t.value}>
                          {t.label}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </Select>
              </div>
              <div className="col-span-2 space-y-1.5">
                <Label>Label</Label>
                <Input
                  value={linkLabel}
                  onChange={(e) => setLinkLabel(e.target.value)}
                  placeholder="Design system"
                  required
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>URL</Label>
              <Input
                type="url"
                value={linkUrl}
                onChange={(e) => setLinkUrl(e.target.value)}
                placeholder="https://figma.com/file/…"
                required
              />
            </div>
            <div className="flex justify-end">
              <Button type="submit" disabled={createLink.isPending}>
                <Plus className="h-4 w-4" /> Add link
              </Button>
            </div>
          </form>
        </div>
      </Dialog>

      {/* Members dialog */}
      <Dialog
        open={!!memberFor}
        onClose={() => setMemberFor(null)}
        title={`Members · ${memberFor?.name ?? ""}`}
        description="Members can view and upload documents in this project."
      >
        <div className="max-h-72 space-y-1 overflow-y-auto">
          {(users || []).map((u) => {
            const checked = selected.includes(u.id);
            return (
              <label
                key={u.id}
                className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 hover:bg-accent"
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={(e) =>
                    setSelected((s) =>
                      e.target.checked ? [...s, u.id] : s.filter((x) => x !== u.id)
                    )
                  }
                />
                <span className="text-sm">{u.email}</span>
                <Badge variant="outline" className="ml-auto">
                  {u.role}
                </Badge>
              </label>
            );
          })}
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="outline" onClick={() => setMemberFor(null)}>
            Cancel
          </Button>
          <Button onClick={saveMembers} disabled={assign.isPending}>
            Save
          </Button>
        </div>
      </Dialog>
    </div>
  );
}

export default function ProjectsPage() {
  return (
    <AuthGuard blockAudience>
      <ProjectsInner />
    </AuthGuard>
  );
}
