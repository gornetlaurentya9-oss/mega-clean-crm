import { type ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { trpc } from "../lib/trpc";
import { useAuth } from "../hooks/useAuth";
import { cx } from "./ui";
import { Logo } from "./Logo";

const NAV_ITEMS = [
  { href: "/", label: "Home", icon: "🏠" },
  { href: "/roster", label: "Roster", icon: "🗓️" },
  { href: "/clients", label: "Clients", icon: "👥" },
  { href: "/employees", label: "Staff", icon: "🧑‍🔧" },
  { href: "/tomorrow", label: "Tomorrow", icon: "💬" },
  { href: "/invoicing", label: "Invoicing", icon: "🧾" },
  { href: "/import", label: "Import", icon: "📥" },
];

export default function Layout({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const { refetch } = useAuth();
  const logout = trpc.auth.logout.useMutation({ onSuccess: () => refetch() });

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <header className="no-print sticky top-0 z-30 flex items-center justify-between border-b border-brand-secondary/20 bg-white px-4 py-2.5 shadow-sm">
        <Link href="/" className="flex items-center">
          <Logo size="sm" />
        </Link>
        <button
          onClick={() => logout.mutate()}
          className="min-h-[40px] rounded-control px-3 text-sm font-medium text-brand-secondary transition-colors duration-150 hover:bg-brand-accent/10 hover:text-brand-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent"
        >
          Log out
        </button>
      </header>

      <main key={location} className="mx-auto max-w-5xl animate-fade-slide-in px-3 py-4 sm:px-6">
        {children}
      </main>

      <nav className="no-print fixed inset-x-0 bottom-0 z-30 flex justify-around border-t border-brand-secondary/20 bg-white py-1 shadow-[0_-2px_8px_-2px_rgba(16,56,91,0.1)]">
        {NAV_ITEMS.map((item) => {
          const active = item.href === "/" ? location === "/" : location.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cx(
                "flex min-h-[56px] flex-1 flex-col items-center justify-center gap-0.5 rounded-control text-xs font-medium transition-colors duration-150",
                active ? "text-brand-primary" : "text-gray-500 hover:text-brand-accent"
              )}
            >
              <span className={cx("text-lg leading-none transition-transform duration-150", active && "scale-110")}>
                {item.icon}
              </span>
              {item.label}
              {active && <span className="mt-0.5 h-1 w-1 rounded-full bg-brand-primary" aria-hidden="true" />}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
