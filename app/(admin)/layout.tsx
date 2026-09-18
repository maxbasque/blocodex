import { requireAdmin } from "@/lib/auth";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireAdmin();

  return (
    <div className="flex flex-1 flex-col">
      <header className="border-b border-black/10 px-6 py-4 dark:border-white/15">
        <h1 className="text-lg font-semibold">Blocodex Admin</h1>
      </header>
      <main className="flex-1 px-6 py-8">{children}</main>
    </div>
  );
}
