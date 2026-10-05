"use client";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { api } from "@/lib/api";
import { getStoredRefresh, useAuthStore } from "@/lib/auth-store";
import { Button } from "./ui/button";
import { ThemeToggle } from "./theme-toggle";
import { initials } from "@/lib/utils";
import { Breadcrumbs } from "./breadcrumbs";
import { MobileNav } from "./mobile-nav";

export function Topbar() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);

  async function logout() {
    const refresh = getStoredRefresh();
    try {
      if (refresh) await api.post("/auth/logout", { refresh });
    } catch {
      /* best effort */
    }
    useAuthStore.getState().clear();
    router.replace("/login");
  }

  return (
    <header className="flex h-14 items-center justify-between border-b border-border px-2 md:px-6">
      <div className="flex min-w-0 items-center gap-1">
        <MobileNav />
        <Breadcrumbs />
      </div>
      <div className="flex items-center gap-2">
        <ThemeToggle />
        <div className="flex items-center gap-2 rounded-md border border-border px-2 py-1">
          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-secondary text-[10px] font-semibold">
            {initials(user?.full_name)}
          </div>
          <span className="hidden text-sm sm:inline">{user?.email}</span>
        </div>
        <Button variant="ghost" size="icon" onClick={logout} aria-label="Log out">
          <LogOut className="h-4 w-4" />
        </Button>
      </div>
    </header>
  );
}
