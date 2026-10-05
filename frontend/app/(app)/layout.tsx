import { AuthGuard } from "@/components/auth-guard";
import { Sidebar } from "@/components/sidebar";
import { Topbar } from "@/components/topbar";
import { RealtimeNotifier } from "@/components/realtime-notifier";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard>
      {/* WebSocket → instant toast + browser notification + nav badges. */}
      <RealtimeNotifier />
      {/* 100dvh (not 100vh) so the mobile address bar doesn't cause overflow. */}
      <div className="flex h-[100dvh] overflow-hidden">
        <Sidebar />
        <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
          <Topbar />
          <main className="flex-1 overflow-y-auto p-4 pb-[max(1rem,env(safe-area-inset-bottom))] md:p-6">
            {children}
          </main>
        </div>
      </div>
    </AuthGuard>
  );
}
