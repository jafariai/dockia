"use client";
import { useState } from "react";
import { format } from "date-fns";
import { Check, Copy, KeyRound, Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { apiErrorMessage } from "@/lib/api";
import { copyToClipboard } from "@/lib/utils";
import {
  useApiTokens,
  useCreateApiToken,
  useRevokeApiToken,
} from "@/lib/hooks";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function ApiTokensCard() {
  const { data: tokens, isLoading } = useApiTokens();
  const create = useCreateApiToken();
  const revoke = useRevokeApiToken();

  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  // The freshly minted plaintext — shown once, then never retrievable.
  const [newToken, setNewToken] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    try {
      const result = await create.mutateAsync(name.trim() || "MCP token");
      setNewToken(result.token);
      setName("");
    } catch (err) {
      toast.error(apiErrorMessage(err, "Could not create token"));
    }
  }

  async function onRevoke(id: number) {
    if (!confirm("Revoke this token? Any client using it will stop working.")) return;
    try {
      await revoke.mutateAsync(id);
      toast.success("Token revoked");
    } catch (err) {
      toast.error(apiErrorMessage(err, "Revoke failed"));
    }
  }

  async function copyToken() {
    if (!newToken) return;
    if (await copyToClipboard(newToken)) {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  }

  function closeDialog() {
    setOpen(false);
    setNewToken(null);
    setName("");
    setCopied(false);
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
        <CardTitle className="flex items-center gap-2">
          <KeyRound className="h-4 w-4" /> API tokens
        </CardTitle>
        <Button size="sm" onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4" /> New token
        </Button>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <p className="text-muted-foreground">
          Service credentials for scripted access — used by the MCP server and
          scripts to create and edit documents on your behalf. A token inherits your
          permissions and project access.
        </p>

        {isLoading ? (
          <p className="text-muted-foreground">Loading…</p>
        ) : tokens && tokens.length > 0 ? (
          <ul className="divide-y divide-border rounded-lg border border-border">
            {tokens.map((t) => (
              <li
                key={t.id}
                className="flex items-center justify-between gap-3 px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium">{t.name}</p>
                  <p className="text-xs text-muted-foreground">
                    <code>{t.prefix}…</code> · created{" "}
                    {format(new Date(t.created_at), "PP")}
                    {t.last_used_at
                      ? ` · last used ${format(new Date(t.last_used_at), "PP")}`
                      : " · never used"}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => onRevoke(t.id)}
                  aria-label="Revoke token"
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-muted-foreground">No tokens yet.</p>
        )}
      </CardContent>

      <Dialog
        open={open}
        onClose={closeDialog}
        title="Create API token"
        description="Give it a recognizable name (e.g. the machine or tool that will use it)."
      >
        {newToken ? (
          <div className="space-y-3">
            <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
              Copy this token now — it won&apos;t be shown again.
            </div>
            <div className="flex items-center gap-2">
              <code className="flex-1 overflow-x-auto rounded-md border border-border bg-muted px-3 py-2 text-xs">
                {newToken}
              </code>
              <Button variant="outline" size="icon" onClick={copyToken} aria-label="Copy">
                {copied ? (
                  <Check className="h-4 w-4 text-green-600" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>
            <div className="flex justify-end">
              <Button onClick={closeDialog}>Done</Button>
            </div>
          </div>
        ) : (
          <form onSubmit={onCreate} className="space-y-4">
            <div className="space-y-1.5">
              <Label>Token name</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="MCP server on my laptop"
                autoFocus
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={closeDialog}>
                Cancel
              </Button>
              <Button type="submit" disabled={create.isPending}>
                {create.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                Create
              </Button>
            </div>
          </form>
        )}
      </Dialog>
    </Card>
  );
}
