"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/auth-store";
import { Loader2 } from "lucide-react";

/** Client-side gate. The API also enforces auth on every request, so this is
 *  a UX convenience, not the security boundary. */
export function AuthGuard({
  children,
  adminOnly = false,
  blockAudience = false,
}: {
  children: React.ReactNode;
  adminOnly?: boolean;
  /** Read-only viewers are kept out of management pages (projects, etc.). */
  blockAudience?: boolean;
}) {
  const router = useRouter();
  const { user, accessToken, initialized } = useAuthStore();

  const denied =
    !!user &&
    ((adminOnly && user.role !== "admin") ||
      (blockAudience && user.role === "audience"));

  useEffect(() => {
    if (!initialized) return;
    if (!accessToken || !user) {
      router.replace("/login");
    } else if (denied) {
      router.replace("/dashboard");
    }
  }, [initialized, accessToken, user, denied, router]);

  if (!initialized || !accessToken || !user) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (denied) return null;
  return <>{children}</>;
}
