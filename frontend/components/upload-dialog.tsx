"use client";
import { useState } from "react";
import { Loader2, Upload } from "lucide-react";
import { toast } from "sonner";
import { apiErrorMessage } from "@/lib/api";
import { useCategories, useProjects, useUploadDocument } from "@/lib/hooks";
import { Button } from "./ui/button";
import { Dialog } from "./ui/dialog";
import { Dropzone } from "./ui/dropzone";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Select } from "./ui/select";
import { Textarea } from "./ui/textarea";

export function UploadDialog() {
  const [open, setOpen] = useState(false);
  const { data: projects } = useProjects();
  const { data: categories } = useCategories();
  const upload = useUploadDocument();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [project, setProject] = useState("");
  const [category, setCategory] = useState("");
  const [tags, setTags] = useState("");
  const [renderMode, setRenderMode] = useState<"sanitized" | "interactive">(
    "sanitized"
  );
  const [file, setFile] = useState<File | null>(null);

  function reset() {
    setTitle("");
    setDescription("");
    setProject("");
    setCategory("");
    setTags("");
    setRenderMode("sanitized");
    setFile(null);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return toast.error("Please choose an HTML file");
    const form = new FormData();
    form.append("title", title);
    form.append("description", description);
    form.append("project", project);
    form.append("category", category);
    form.append(
      "tags",
      JSON.stringify(
        tags
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean)
      )
    );
    form.append("render_mode", renderMode);
    form.append("html_file", file);
    try {
      await upload.mutateAsync(form);
      toast.success("Document uploaded");
      reset();
      setOpen(false);
    } catch (err) {
      toast.error(apiErrorMessage(err, "Upload failed"));
    }
  }

  const activeProjects = (projects || []).filter((p) => !p.is_archived);

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Upload className="h-4 w-4" /> Upload
      </Button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="Upload HTML document"
        description="Choose how the document is rendered in the isolated preview."
      >
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label>Title</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} required />
          </div>
          <div className="space-y-1.5">
            <Label>Description</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
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
            <Label>Tags (comma separated)</Label>
            <Input
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="api, v2, internal"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Rendering mode</Label>
            <Select
              value={renderMode}
              onChange={(e) =>
                setRenderMode(e.target.value as "sanitized" | "interactive")
              }
            >
              <option value="sanitized">
                Sanitized — strip scripts (static HTML, safest)
              </option>
              <option value="interactive">
                Interactive — run scripts in isolated sandbox (for JS docs)
              </option>
            </Select>
            <p className="text-xs text-muted-foreground">
              {renderMode === "interactive"
                ? "Scripts run inside an opaque-origin sandbox: the document cannot read your session, cookies, or other pages. Use for JS-driven docs (charts, apps)."
                : "All scripts are removed. Choose this for static HTML; JS-driven documents will appear blank."}
            </p>
          </div>
          <div className="space-y-1.5">
            <Label>HTML file</Label>
            <Dropzone
              file={file}
              onFile={(f) => {
                setFile(f);
                // Prefill the title from the filename if still empty.
                if (f && !title) setTitle(f.name.replace(/\.html?$/i, ""));
              }}
              accept=".html,.htm,text/html"
              hint="Drop an .html or .htm file here"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={upload.isPending}>
              {upload.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Upload
            </Button>
          </div>
        </form>
      </Dialog>
    </>
  );
}
