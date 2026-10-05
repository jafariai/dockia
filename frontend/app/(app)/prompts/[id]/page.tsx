"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { ArrowLeft, Check, Copy, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { apiErrorMessage } from "@/lib/api";
import { useDeletePrompt, usePrompt } from "@/lib/hooks";
import { useAuthStore } from "@/lib/auth-store";
import { copyToClipboard } from "@/lib/utils";
import { PromptFormDialog } from "@/components/prompt-form-dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function PromptDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const promptId = Number(params.id);
  const router = useRouter();
  const { data: prompt, isLoading } = usePrompt(promptId);
  const del = useDeletePrompt();
  const user = useAuthStore((s) => s.user);

  const [editOpen, setEditOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const canManage =
    user?.role === "admin" || (prompt && prompt.owner === user?.id);

  async function copyContent() {
    if (!prompt) return;
    if (await copyToClipboard(prompt.content)) {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
      toast.success("Prompt copied");
    } else {
      toast.error("Couldn't copy — please select and copy manually");
    }
  }

  async function onDelete() {
    if (!confirm("Delete this prompt permanently?")) return;
    try {
      await del.mutateAsync(promptId);
      toast.success("Prompt deleted");
      router.replace("/prompts");
    } catch (err) {
      toast.error(apiErrorMessage(err, "Delete failed"));
    }
  }

  if (isLoading || !prompt) {
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
        href="/prompts"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Back to prompts
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight">{prompt.title}</h1>
          {prompt.description && (
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
              {prompt.description}
            </p>
          )}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={copyContent}>
            {copied ? (
              <Check className="h-4 w-4 text-green-600" />
            ) : (
              <Copy className="h-4 w-4" />
            )}
            Copy
          </Button>
          {canManage && (
            <Button variant="outline" onClick={() => setEditOpen(true)}>
              <Pencil className="h-4 w-4" /> Edit
            </Button>
          )}
          {canManage && (
            <Button variant="destructive" onClick={onDelete} disabled={del.isPending}>
              <Trash2 className="h-4 w-4" /> Delete
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Prompt</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="max-h-[520px] overflow-auto whitespace-pre-wrap break-words rounded-md border border-border bg-muted/40 p-4 font-mono text-sm">
              {prompt.content}
            </pre>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <Field
              label="Project"
              value={<Badge variant="secondary">{prompt.project_name}</Badge>}
            />
            <Field label="Category" value={prompt.category_name} />
            <Field label="Owner" value={prompt.owner_email || "—"} />
            <Field
              label="Created"
              value={format(new Date(prompt.created_at), "PPpp")}
            />
            <Field
              label="Updated"
              value={format(new Date(prompt.updated_at), "PPpp")}
            />
            <div>
              <p className="mb-1 text-muted-foreground">Tags</p>
              <div className="flex flex-wrap gap-1">
                {prompt.tags.length ? (
                  prompt.tags.map((t) => (
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
      </div>

      <PromptFormDialog
        open={editOpen}
        onClose={() => setEditOpen(false)}
        prompt={prompt}
      />
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
