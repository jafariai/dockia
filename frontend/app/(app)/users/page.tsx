"use client";
import { useState } from "react";
import { KeyRound, Plus, ShieldCheck, UserCog } from "lucide-react";
import { toast } from "sonner";
import { apiErrorMessage } from "@/lib/api";
import {
  useCreateUser,
  useProjects,
  useResetPassword,
  useUpdateUser,
  useUsers,
} from "@/lib/hooks";
import type { User } from "@/lib/types";
import { AuthGuard } from "@/components/auth-guard";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";

function UsersInner() {
  const { data: users, isLoading } = useUsers();
  const { data: projects } = useProjects();
  const create = useCreateUser();
  const update = useUpdateUser();
  const reset = useResetPassword();

  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({
    first_name: "",
    last_name: "",
    email: "",
    password: "",
    role: "member",
  });
  const [permFor, setPermFor] = useState<User | null>(null);
  const [perms, setPerms] = useState<number[]>([]);
  const [resetFor, setResetFor] = useState<User | null>(null);
  const [newPassword, setNewPassword] = useState("");

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    try {
      await create.mutateAsync(form);
      toast.success("User created");
      setForm({ first_name: "", last_name: "", email: "", password: "", role: "member" });
      setCreateOpen(false);
    } catch (err) {
      toast.error(apiErrorMessage(err, "Could not create user"));
    }
  }

  async function toggleActive(u: User) {
    try {
      await update.mutateAsync({ id: u.id, is_active: !u.is_active });
      toast.success(u.is_active ? "User disabled" : "User enabled");
    } catch (err) {
      toast.error(apiErrorMessage(err));
    }
  }

  async function changeRole(u: User, role: string) {
    try {
      await update.mutateAsync({ id: u.id, role });
      toast.success("Role updated");
    } catch (err) {
      toast.error(apiErrorMessage(err));
    }
  }

  async function savePerms() {
    if (!permFor) return;
    try {
      await update.mutateAsync({ id: permFor.id, project_ids: perms });
      toast.success("Permissions updated");
      setPermFor(null);
    } catch (err) {
      toast.error(apiErrorMessage(err));
    }
  }

  async function doReset(e: React.FormEvent) {
    e.preventDefault();
    if (!resetFor) return;
    try {
      await reset.mutateAsync({ id: resetFor.id, password: newPassword });
      toast.success("Password reset");
      setResetFor(null);
      setNewPassword("");
    } catch (err) {
      toast.error(apiErrorMessage(err, "Could not reset password"));
    }
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Users"
        description="Manage team members, roles and project access."
        action={
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4" /> New user
          </Button>
        }
      />

      {isLoading ? (
        <Skeleton className="h-64" />
      ) : (
        <div className="rounded-xl border border-border">
          <Table>
            <THead>
              <TR className="hover:bg-transparent">
                <TH>Name</TH>
                <TH>Email</TH>
                <TH>Role</TH>
                <TH>Status</TH>
                <TH className="text-right">Actions</TH>
              </TR>
            </THead>
            <TBody>
              {(users || []).map((u) => (
                <TR key={u.id}>
                  <TD className="font-medium">{u.full_name}</TD>
                  <TD className="text-muted-foreground">{u.email}</TD>
                  <TD>
                    <Select
                      className="h-8 w-28"
                      value={u.role}
                      onChange={(e) => changeRole(u, e.target.value)}
                    >
                      <option value="member">member</option>
                      <option value="admin">admin</option>
                      <option value="audience">audience</option>
                    </Select>
                  </TD>
                  <TD>
                    {u.is_active ? (
                      <Badge variant="success">Active</Badge>
                    ) : (
                      <Badge variant="destructive">Disabled</Badge>
                    )}
                  </TD>
                  <TD className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setPermFor(u);
                          setPerms(u.project_ids);
                        }}
                      >
                        <UserCog className="h-4 w-4" /> Access
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setResetFor(u)}
                      >
                        <KeyRound className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => toggleActive(u)}>
                        {u.is_active ? "Disable" : "Enable"}
                      </Button>
                    </div>
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </div>
      )}

      {/* Create user */}
      <Dialog open={createOpen} onClose={() => setCreateOpen(false)} title="New user">
        <form onSubmit={onCreate} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>First name</Label>
              <Input
                value={form.first_name}
                onChange={(e) => setForm({ ...form, first_name: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Last name</Label>
              <Input
                value={form.last_name}
                onChange={(e) => setForm({ ...form, last_name: e.target.value })}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Email</Label>
            <Input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label>Temporary password</Label>
            <Input
              type="text"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label>Role</Label>
            <Select
              value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value })}
            >
              <option value="member">Member</option>
              <option value="admin">Admin</option>
              <option value="audience">Audience (read-only viewer)</option>
            </Select>
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={create.isPending}>
              Create user
            </Button>
          </div>
        </form>
      </Dialog>

      {/* Project access */}
      <Dialog
        open={!!permFor}
        onClose={() => setPermFor(null)}
        title={`Project access · ${permFor?.email ?? ""}`}
        description="Admins implicitly have access to every project."
      >
        <div className="max-h-72 space-y-1 overflow-y-auto">
          {(projects || []).map((p) => (
            <label
              key={p.id}
              className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 hover:bg-accent"
            >
              <input
                type="checkbox"
                checked={perms.includes(p.id)}
                onChange={(e) =>
                  setPerms((s) =>
                    e.target.checked ? [...s, p.id] : s.filter((x) => x !== p.id)
                  )
                }
              />
              <span className="text-sm">{p.name}</span>
            </label>
          ))}
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="outline" onClick={() => setPermFor(null)}>
            Cancel
          </Button>
          <Button onClick={savePerms} disabled={update.isPending}>
            Save
          </Button>
        </div>
      </Dialog>

      {/* Reset password */}
      <Dialog
        open={!!resetFor}
        onClose={() => setResetFor(null)}
        title={`Reset password · ${resetFor?.email ?? ""}`}
      >
        <form onSubmit={doReset} className="space-y-4">
          <div className="space-y-1.5">
            <Label>New password</Label>
            <Input
              type="text"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setResetFor(null)}>
              Cancel
            </Button>
            <Button type="submit" disabled={reset.isPending}>
              Reset
            </Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}

export default function UsersPage() {
  return (
    <AuthGuard adminOnly>
      <UsersInner />
    </AuthGuard>
  );
}
