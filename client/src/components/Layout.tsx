import { type ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { trpc } from "../lib/trpc";
import { useAuth } from "../hooks/useAuth";
import { cx } from "./ui";
import { Logo } from "./Logo";
import { BellIcon, CalendarIcon, HomeIcon, ImportIcon, MessageIcon, ReceiptIcon, StaffIcon, UsersIcon } from "./Icons";

const NAV_ITEMS = [
  { href: "/", label: "Home", Icon: HomeIcon },
  { href: "/roster", label: "Roster", Icon: CalendarIcon },
  { href: "/clients", label: "Clients", Icon: UsersIcon },
  { href: "/employees", label: "Staff", Icon: StaffIcon },
  { href: "/tomorrow", label: "Tomorrow", Icon: MessageIcon },
  { href: "/heads-up", label: "Heads-up", Icon: BellIcon },
  { href: "/invoicing", label: "Invoicing", Icon: ReceiptIcon },
  { href: "/import", label: "Import", Icon: ImportIcon },
];

export default function Layout({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const { refetch } = useAuth();
  const logout = trpc.auth.logout.useMutation({ onSuccess: () => refetch() });

  function isActive(href: string) {
    return href === "/" ? location === "/" : location.startsWith(href);
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20 md:flex md:pb-0">
      {/* Desktop sidebar (md and up) — hidden on mobile, where the bottom tab bar below takes over. */}
      <aside className="no-print sticky top-0 hidden h-screen w-56 shrink-0 flex-col border-r border-brand-secondary/20 bg-white md:flex">
        <div className="flex items-center px-4 py-4">
          <Logo size="sm" />
        </div>
        <nav className="flex-1 space-y-1 overflow-y-auto px-3">
          {NAV_ITEMS.map((item) => {
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cx(
                  "flex min-h-[44px] items-center gap-3 rounded-control px-3 text-sm font-medium transition-colors duration-150",
                  active ? "bg-brand-accent/10 text-brand-primary" : "text-gray-600 hover:bg-gray-50 hover:text-brand-accent"
                )}
              >
                <item.Icon size={20} strokeWidth={active ? 2 : 1.75} className="shrink-0" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-brand-secondary/20 p-3">
          <button
            onClick={() => logout.mutate()}
            className="flex min-h-[44px] w-full items-center justify-center rounded-control px-3 text-sm font-medium text-brand-secondary transition-colors duration-150 hover:bg-brand-accent/10 hover:text-brand-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent"
          >
            Log out
          </button>
        </div>
      </aside>

      <div className="flex min-h-screen flex-1 flex-col">
        {/* Logo only shows here on mobile — the sidebar's logo replaces it on desktop, and the
            logout button stays reachable at both breakpoints via this header. */}
        <header className="no-print sticky top-0 z-30 flex items-center justify-between border-b border-brand-secondary/20 bg-white px-4 py-2.5 shadow-sm md:justify-end md:px-6">
          <Link href="/" className="flex items-center md:hidden">
            <Logo size="sm" />
          </Link>
          <button
            onClick={() => logout.mutate()}
            className="min-h-[40px] rounded-control px-3 text-sm font-medium text-brand-secondary transition-colors duration-150 hover:bg-brand-accent/10 hover:text-brand-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent"
          >
            Log out
          </button>
        </header>

        <main key={location} className="mx-auto w-full max-w-5xl flex-1 animate-fade-slide-in px-3 py-4 sm:px-6 md:max-w-6xl md:px-8 md:py-6">
          {children}
        </main>

        {/* Mobile bottom tab bar — hidden at md and up, where the sidebar takes over. */}
        <nav className="no-print fixed inset-x-0 bottom-0 z-30 flex justify-around border-t border-brand-secondary/20 bg-white py-1 shadow-[0_-2px_8px_-2px_rgba(16,56,91,0.1)] md:hidden">
          {NAV_ITEMS.map((item) => {
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cx(
                  "flex min-h-[56px] flex-1 flex-col items-center justify-center gap-0.5 rounded-control text-xs font-medium transition-colors duration-150",
                  active ? "text-brand-primary" : "text-gray-500 hover:text-brand-accent"
                )}
              >
                <item.Icon
                  size={22}
                  className={cx("transition-transform duration-150", active && "scale-110")}
                  strokeWidth={active ? 2 : 1.75}
                />
                {item.label}
                {active && <span className="mt-0.5 h-1 w-1 rounded-full bg-brand-primary" aria-hidden="true" />}
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
