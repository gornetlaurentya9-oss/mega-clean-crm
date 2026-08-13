import { type ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { trpc } from "../lib/trpc";
import { useAuth } from "../hooks/useAuth";
import { cx } from "./ui";

const NAV_ITEMS = [
  { href: "/", label: "Home", icon: "🏠" },
  { href: "/roster", label: "Roster", icon: "🗓️" },
  { href: "/clients", label: "Clients", icon: "👥" },
  { href: "/employees", label: "Staff", icon: "🧑‍🔧" },
  { href: "/tomorrow", label: "Tomorrow", icon: "💬" },
  { href: "/invoicing", label: "Invoicing", icon: "🧾" },
];

export default function Layout({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const { refetch } = useAuth();
  const logout = trpc.auth.logout.useMutation({ onSuccess: () => refetch() });

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <header className="no-print sticky top-0 z-30 flex items-center justify-between border-b border-gray-200 bg-white px-4 py-3">
        <Link href="/" className="flex items-center gap-2 font-bold text-brand-700">
          <span>🧹</span>
          <span>Mega Clean CRM</span>
        </Link>
        <button
          onClick={() => logout.mutate()}
          className="min-h-[40px] rounded-lg px-3 text-sm font-medium text-gray-600 hover:bg-gray-100"
        >
          Log out
        </button>
      </header>

      <main className="mx-auto max-w-5xl px-3 py-4 sm:px-6">{children}</main>

      <nav className="no-print fixed inset-x-0 bottom-0 z-30 flex justify-around border-t border-gray-200 bg-white py-1">
        {NAV_ITEMS.map((item) => {
          const active = item.href === "/" ? location === "/" : location.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cx(
                "flex min-h-[56px] flex-1 flex-col items-center justify-center gap-0.5 rounded-lg text-xs font-medium",
                active ? "text-brand-700" : "text-gray-500"
              )}
            >
              <span className="text-lg leading-none">{item.icon}</span>
              {item.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
