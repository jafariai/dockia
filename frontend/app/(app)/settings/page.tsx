"use client";
import { useTheme } from "next-themes";
import { Monitor, Moon, Sun } from "lucide-react";
import { useAuthStore } from "@/lib/auth-store";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ApiTokensCard } from "@/components/api-tokens-card";
import { NotificationsCard } from "@/components/notifications-card";

export default function SettingsPage() {
  const user = useAuthStore((s) => s.user);
  const { theme, setTheme } = useTheme();
  // Read-only viewers don't mint service credentials.
  const canUseTokens = user?.role !== "audience";

  return (
    <div className="max-w-2xl space-y-5">
      <PageHeader title="Settings" description="Your profile and preferences." />

      <Card>
        <CardHeader>
          <CardTitle>Profile</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <Row label="Name" value={user?.full_name || "—"} />
          <Row label="Email" value={user?.email || "—"} />
          <Row
            label="Role"
            value={<Badge variant="secondary">{user?.role}</Badge>}
          />
          <Row
            label="Projects"
            value={`${user?.project_ids.length ?? 0} assigned`}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Appearance</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            {[
              { id: "light", icon: Sun, label: "Light" },
              { id: "dark", icon: Moon, label: "Dark" },
              { id: "system", icon: Monitor, label: "System" },
            ].map(({ id, icon: Icon, label }) => (
              <Button
                key={id}
                variant={theme === id ? "default" : "outline"}
                size="sm"
                onClick={() => setTheme(id)}
              >
                <Icon className="h-4 w-4" /> {label}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      <NotificationsCard />

      {canUseTokens && <ApiTokensCard />}
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}
