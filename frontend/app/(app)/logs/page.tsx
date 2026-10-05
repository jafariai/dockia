"use client";
import { useState } from "react";
import { format } from "date-fns";
import { Download, Search } from "lucide-react";
import { api } from "@/lib/api";
import { useLogs } from "@/lib/hooks";
import { AuthGuard } from "@/components/auth-guard";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Pagination } from "@/components/ui/pagination";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";

const ACTIONS = [
  "login",
  "logout",
  "upload_document",
  "update_document",
  "delete_document",
  "create_project",
  "create_user",
  "update_user",
  "disable_user",
  "reset_password",
];

function LogsInner() {
  const [action, setAction] = useState("");
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [page, setPage] = useState(1);
  const { data, isLoading } = useLogs({ action, search, page });
  const totalPages = data ? Math.max(1, Math.ceil(data.count / 20)) : 1;

  async function exportCsv() {
    const res = await api.get("/logs/export", {
      params: { action, search },
      responseType: "blob",
    });
    const url = URL.createObjectURL(res.data as Blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "audit_logs.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Audit Logs"
        description="Security-relevant actions across the platform."
        action={
          <Button variant="outline" onClick={exportCsv}>
            <Download className="h-4 w-4" /> Export CSV
          </Button>
        }
      />

      <div className="flex flex-wrap gap-3">
        <form
          className="relative flex-1"
          onSubmit={(e) => {
            e.preventDefault();
            setPage(1);
            setSearch(searchInput);
          }}
        >
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-8"
            placeholder="Search by email, action, target…"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
          />
        </form>
        <Select
          className="w-48"
          value={action}
          onChange={(e) => {
            setPage(1);
            setAction(e.target.value);
          }}
        >
          <option value="">All actions</option>
          {ACTIONS.map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </Select>
      </div>

      {isLoading ? (
        <Skeleton className="h-64" />
      ) : (
        <div className="rounded-xl border border-border">
          <Table>
            <THead>
              <TR className="hover:bg-transparent">
                <TH>Time</TH>
                <TH>User</TH>
                <TH>Action</TH>
                <TH>Target</TH>
                <TH>IP</TH>
              </TR>
            </THead>
            <TBody>
              {(data?.results || []).map((log) => (
                <TR key={log.id}>
                  <TD className="whitespace-nowrap text-muted-foreground">
                    {format(new Date(log.timestamp), "MMM d, HH:mm:ss")}
                  </TD>
                  <TD>{log.user_email || "system"}</TD>
                  <TD>
                    <Badge variant="outline">{log.action}</Badge>
                  </TD>
                  <TD className="text-muted-foreground">
                    {log.target_type}
                    {log.target_id ? ` #${log.target_id}` : ""}
                  </TD>
                  <TD className="text-muted-foreground">{log.ip_address || "—"}</TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </div>
      )}

      <Pagination
        page={page}
        totalPages={totalPages}
        count={data?.count ?? 0}
        noun="event"
        onPrev={() => setPage((p) => p - 1)}
        onNext={() => setPage((p) => p + 1)}
      />
    </div>
  );
}

export default function LogsPage() {
  return (
    <AuthGuard adminOnly>
      <LogsInner />
    </AuthGuard>
  );
}
