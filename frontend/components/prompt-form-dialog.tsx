"use client";
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { apiErrorMessage } from "@/lib/api";
import {
  useCategories,
  useCreatePrompt,
  useProjects,
  useUpdatePrompt,
} from "@/lib/hooks";
import type { Prompt } from "@/lib/types";
import { Button } from "./ui/button";
import { Dialog } from "./ui/dialog";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Select } from "./ui/select";
import { Textarea } from "./ui/textarea";

/** Controlled create/edit dialog. Pass `prompt` to edit, omit it to create. */
export function PromptFormDialog({
  open,
  onClose,
  prompt,
}: {
  open: boolean;
  onClose: () => void;
  prompt?: Prompt | null;
}) {
  const isEdit = !!prompt;
  const { data: projects } = useProjects();
  const { data: categories } = useCategories();
  const create = useCreatePrompt();
  const update = useUpdatePrompt();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [project, setProject] = useState("");
  const [category, setCategory] = useState("");
  const [tags, setTags] = useState("");
  const [content, setContent] = useState("");

  // (Re)seed the form whenever it opens or the target prompt changes.
  useEffect(() => {
    if (!open) return;
    setTitle(prompt?.title ?? "");
    setDescription(prompt?.description ?? "");
    setProject(prompt ? String(prompt.project) : "");
    setCategory(prompt ? String(prompt.category) : "");
    setTags(prompt ? prompt.tags.join(", ") : "");
    setContent(prompt?.content ?? "");
  }, [open, prompt]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const data: Partial<Prompt> = {
      title,
      description,
      project: Number(project),
      category: Number(category),
      tags: tags.split(",").map((t) => t.trim()).filter(Boolean),
      content,
    };
    try {
      if (isEdit && prompt) {
        await update.mutateAsync({ id: prompt.id, data });
      } else {
        await create.mutateAsync(data);
      }
      toast.success(isEdit ? "Prompt updated" : "Prompt created");
      onClose();
    } catch (err) {
      toast.error(apiErrorMessage(err, "Save failed"));
    }
  }

  const pending = create.isPending || update.isPending;
  const activeProjects = (projects || []).filter((p) => !p.is_archived);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={isEdit ? "Edit prompt" : "New prompt"}
      description="Write a prompt or instruction to share with your team."
      className="max-w-2xl"
    >
      <form onSubmit={submit} className="space-y-4">
        <div className="space-y-1.5">
          <Label>Title</Label>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} required />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>Project</Label>
            <Select
              value={project}
              onChange={(e) => setProject(e.target.value)}
              required
            >
              <option value="">Select…</option>
              {activeProjects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Category</Label>
            <Select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              required
            >
              <option value="">Select…</option>
              {(categories || []).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </div>
        </div>
        <div className="space-y-1.5">
          <Label>Description (optional)</Label>
          <Input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Short summary of what this prompt is for"
          />
        </div>
        <div className="space-y-1.5">
          <Label>Prompt</Label>
          <Textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            required
            rows={12}
            className="font-mono text-sm"
            placeholder="Write the prompt / instruction here…"
          />
        </div>
        <div className="space-y-1.5">
          <Label>Tags (comma separated)</Label>
          <Input
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            placeholder="review, ai, onboarding"
          />
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={pending}>
            {pending && <Loader2 className="h-4 w-4 animate-spin" />}
            {isEdit ? "Save changes" : "Create prompt"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
