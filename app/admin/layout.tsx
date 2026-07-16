"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { onAuthStateChanged, type User } from "firebase/auth";
import { auth } from "@/frontend/firebase/client";
import { isAdminEmail } from "@/backend/admin";
import { Logo } from "@/frontend/brand";

const NAV = [
  { href: "/admin", label: "Dashboard", icon: "📊" },
  { href: "/admin/users", label: "Users", icon: "👥" },
  { href: "/admin/projects", label: "Projects", icon: "📁" },
  { href: "/admin/waitlist", label: "Waitlist", icon: "📬" },
];

const SOON = [
  "Organizations",
  "Agents",
  "Workflows",
  "Marketplace",
  "Billing",
  "Analytics",
  "Security",
  "Feature Flags",
  "Support",
];

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<User | null>(null);
  const [status, setStatus] = useState<"loading" | "ok" | "denied">("loading");
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      if (!u) {
        router.push("/login");
        return;
      }
      if (!isAdminEmail(u.email)) {
        setStatus("denied");
        setTimeout(() => router.push("/dashboard"), 1800);
        return;
      }
      setUser(u);
      setStatus("ok");
    });
    return () => unsub();
  }, [router]);

  if (status === "loading") {
    return (
      <main className="min-h-screen flex items-center justify-center gap-1.5">
        <span className="typing-dot w-2.5 h-2.5 rounded-full bg-violet-400" />
        <span className="typing-dot w-2.5 h-2.5 rounded-full bg-violet-400" />
        <span className="typing-dot w-2.5 h-2.5 rounded-full bg-violet-400" />
      </main>
    );
  }

  if (status === "denied") {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center gap-2 text-sm">
        <p className="text-red-400 font-medium">Admin access only.</p>
        <p className="text-zinc-500">Redirecting to your dashboard…</p>
      </main>
    );
  }

  return (
    <div className="min-h-screen flex">
      {/* Sidebar */}
      <aside
        className={`glass-strong border-r border-white/5 flex flex-col shrink-0 transition-all duration-300 ${
          collapsed ? "w-[64px]" : "w-[230px]"
        }`}
      >
        <div className="p-4 flex items-center justify-between">
          <Link href="/dashboard">
            <Logo withText={!collapsed} size={26} textClass="text-lg" />
          </Link>
        </div>
        <div className={`px-4 pb-2 ${collapsed ? "hidden" : ""}`}>
          <span className="text-[10px] uppercase tracking-widest text-violet-400 font-semibold">
            Admin Panel
          </span>
        </div>
        <nav className="flex-1 overflow-y-auto px-2 space-y-1">
          {NAV.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                title={item.label}
                className={`flex items-center gap-3 px-3 py-2 rounded-xl text-sm transition-all ${
                  active
                    ? "bg-gradient-to-r from-blue-600/30 to-violet-500/20 text-white border border-violet-500/25"
                    : "text-zinc-400 hover:text-white hover:bg-white/5"
                }`}
              >
                <span>{item.icon}</span>
                {!collapsed && item.label}
              </Link>
            );
          })}
          {!collapsed && (
            <div className="pt-4">
              <p className="px-3 text-[10px] uppercase tracking-widest text-zinc-600 font-semibold">
                Coming soon
              </p>
              <div className="mt-1 space-y-0.5">
                {SOON.map((s) => (
                  <div
                    key={s}
                    className="px-3 py-1.5 text-xs text-zinc-600 flex items-center justify-between"
                  >
                    {s}
                    <span className="text-[9px] border border-white/10 rounded-full px-1.5 py-0.5">
                      soon
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </nav>
        <div className="p-3 border-t border-white/5 space-y-2">
          {!collapsed && (
            <p className="text-[11px] text-zinc-500 truncate px-1">
              {user?.email}
            </p>
          )}
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="btn-ghost w-full py-1.5 rounded-xl text-xs text-zinc-400"
          >
            {collapsed ? "→" : "← Collapse"}
          </button>
        </div>
      </aside>

      {/* Content */}
      <main className="flex-1 min-w-0 overflow-y-auto h-screen">
        <div className="max-w-6xl mx-auto px-6 py-8">{children}</div>
      </main>
    </div>
  );
}
