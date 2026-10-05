"use client";
import { useState } from "react";
import { Bell } from "lucide-react";
import { toast } from "sonner";
import { useNotifStore } from "@/lib/notif-store";
import { subscribeToPush, unsubscribeFromPush } from "@/lib/push";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export function NotificationsCard() {
  const enabled = useNotifStore((s) => s.enabled);
  const setEnabled = useNotifStore((s) => s.setEnabled);
  const [busy, setBusy] = useState(false);

  async function toggle() {
    if (enabled) {
      setEnabled(false);
      void unsubscribeFromPush(); // stop closed-tab pushes too
      return;
    }
    if (typeof Notification === "undefined") {
      toast.error("This browser doesn't support notifications.");
      return;
    }
    setBusy(true);
    try {
      let perm = Notification.permission;
      if (perm === "default") perm = await Notification.requestPermission();
      if (perm === "granted") {
        setEnabled(true);
        toast.success("Browser notifications enabled");
        void subscribeToPush(); // register for closed-tab web push (prod only)
      } else {
        toast.error(
          "Permission blocked — allow notifications for this site in your browser settings."
        );
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bell className="h-4 w-4" /> Notifications
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <p className="text-muted-foreground">
          Get a browser notification when a teammate creates a document or uploads a
          file, and see a “new” badge on the Documents and Files menus.
        </p>
        <div className="flex items-center justify-between">
          <span>Browser notifications</span>
          <Button
            variant={enabled ? "default" : "outline"}
            size="sm"
            onClick={toggle}
            disabled={busy}
          >
            {enabled ? "On" : "Off"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
