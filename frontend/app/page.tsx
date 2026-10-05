"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/auth-store";
import { Loader2 } from "lucide-react";

export default function Home() {
  const router = useRouter();
  const { accessToken, initialized } = useAuthStore();
  useEffect(() => {
    if (!initialized) return;
    router.replace(accessToken ? "/dashboard" : "/login");
  }, [initialized, accessToken, router]);
  return (
    <div className="flex h-screen items-center justify-center">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
    </div>
  );
}
