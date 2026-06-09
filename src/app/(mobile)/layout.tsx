import { redirect } from "next/navigation";

import { MobileNav } from "~/components/mobile-nav";
import { auth } from "~/server/auth";

export default async function MobileLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  return (
    <div className="mx-auto min-h-screen max-w-lg bg-slate-50 pb-24 pt-[env(safe-area-inset-top)]">
      {children}
      <MobileNav />
    </div>
  );
}
