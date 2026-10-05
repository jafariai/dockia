"use client";
import { useState } from "react";
import { Loader2, Upload } from "lucide-react";
import { toast } from "sonner";
import { apiErrorMessage } from "@/lib/api";
import { useCategories, useProjects, useUploadFile } from "@/lib/hooks";
import { Button } from "./ui/button";
import { Dialog } from "./ui/dialog";
import { Dropzone } from "./ui/dropzone";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Select } from "./ui/select";
import { Textarea } from "./ui/textarea";

export function FileUploadDialog() {
  const [open, setOpen] = useState(false);
  const { data: projects } = useProjects();
  const { data: categories } = useCategories();
  const upload = useUploadFile();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [project, setProject] = useState("");
  const [category, setCategory] = useState("");
  const [file, setFile] = useState<File | null>(null);

  function reset() {
    setName("");
    setDescription("");
    setProject("");
    setCategory("");
    setFile(null);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return toast.error("Please choose a file");
    const form = new FormData();
    if (name.trim()) form.append("name", name.trim());
    form.append("description", description);
    form.append("project", project);
    form.append("category", category);
    form.append("file", file);
    try {
      await upload.mutateAsync(form);
      toast.success("File uploaded");
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
        <Upload className="h-4 w-4" /> Upload file
      </Button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="Upload file"
        description="Store any file (backup, asset, archive) on the server — no size limit."
      >
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label>File</Label>
            <Dropzone
              file={file}
              onFile={setFile}
              hint="Drop any file here — no size limit"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Name (optional)</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Defaults to the file name"
            />
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
