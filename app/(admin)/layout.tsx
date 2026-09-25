import Link from "next/link";
import { requireAdmin } from "@/lib/auth";

const NAV = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/sets", label: "Sets" },
  { href: "/admin/gym", label: "Grades & walls" },
];

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireAdmin();

  return (
    <div className="flex flex-1 flex-col">
      <header className="flex flex-wrap items-center gap-x-6 gap-y-2 border-b border-black/10 px-4 py-4 sm:px-6 dark:border-white/15">
        <h1 className="text-lg font-semibold">Blocodex Admin</h1>
        <nav className="flex gap-4 text-sm">
          {NAV.map((item) => (
            <Link key={item.href} href={item.href} className="text-zinc-500 hover:text-foreground">
              {item.label}
            </Link>
          ))}
        </nav>
        <Link href="/" className="ml-auto text-sm text-zinc-500 hover:text-foreground">
          View site →
        </Link>
      </header>
      <main className="flex-1 px-4 py-6 sm:px-6 sm:py-8">{children}</main>
    </div>
  );
}
