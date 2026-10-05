"use client";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import {
  Activity,
  CalendarClock,
  FileText,
  FolderKanban,
  Users,
} from "lucide-react";
import { useDashboard } from "@/lib/hooks";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";

function Metric({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: number | string;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <Card>
      <CardContent className="flex items-center justify-between pt-6">
        <div>
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="mt-1 text-2xl font-semibold">{value}</p>
        </div>
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary">
          <Icon className="h-5 w-5 text-muted-foreground" />
        </div>
      </CardContent>
    </Card>
  );
}

function BarList({
  data,
}: {
  data: { label: string; count: number; color?: string }[];
}) {
  const max = Math.max(1, ...data.map((d) => d.count));
  if (!data.length)
    return <p className="text-sm text-muted-foreground">No data yet.</p>;
  return (
    <div className="space-y-2.5">
      {data.map((d) => (
        <div key={d.label}>
          <div className="mb-1 flex justify-between text-sm">
            <span className="flex items-center gap-2">
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: d.color || "hsl(var(--primary))" }}
              />
              {d.label || "—"}
            </span>
            <span className="text-muted-foreground">{d.count}</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-secondary">
            <div
              className="h-full rounded-full"
              style={{
                width: `${(d.count / max) * 100}%`,
                backgroundColor: d.color || "hsl(var(--primary))",
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function DashboardPage() {
  const { data, isLoading } = useDashboard();

  if (isLoading || !data) {
    return (
      <div>
        <PageHeader title="Dashboard" description="Workspace overview" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Dashboard" description="Workspace overview" />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Metric label="Total documents" value={data.total_documents} icon={FileText} />
        <Metric
          label="Uploaded this week"
          value={data.documents_this_week}
          icon={CalendarClock}
        />
        <Metric label="Projects" value={data.total_projects} icon={FolderKanban} />
        <Metric label="Active users" value={data.active_users} icon={Users} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Documents per project</CardTitle>
          </CardHeader>
          <CardContent>
            <BarList
              data={data.documents_per_project.map((d) => ({
                label: d.project__name,
                count: d.count,
                color: d.project__color,
              }))}
            />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Documents per category</CardTitle>
          </CardHeader>
          <CardContent>
            <BarList
              data={data.documents_per_category.map((d) => ({
                label: d.category__name,
                count: d.count,
                color: d.category__color,
              }))}
            />
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Recent uploads</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.recent_documents.length === 0 && (
              <p className="text-sm text-muted-foreground">No documents yet.</p>
            )}
            {data.recent_documents.map((doc) => (
              <Link
                key={doc.id}
                href={`/documents/${doc.id}`}
                className="flex items-center justify-between rounded-md px-2 py-1.5 hover:bg-accent"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{doc.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {doc.project_name} · {doc.owner_email || "—"}
                  </p>
                </div>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {formatDistanceToNow(new Date(doc.created_at), { addSuffix: true })}
                </span>
              </Link>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-4 w-4" /> Recent activity
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {data.recent_activity.length === 0 && (
              <p className="text-sm text-muted-foreground">
                Activity feed is visible to admins.
              </p>
            )}
            {data.recent_activity.map((a) => (
              <div key={a.id} className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2">
                  <Badge variant="outline">{a.action}</Badge>
                  <span className="text-muted-foreground">
                    {a.user__email || "system"}
                  </span>
                </span>
                <span className="text-xs text-muted-foreground">
                  {formatDistanceToNow(new Date(a.timestamp), { addSuffix: true })}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
