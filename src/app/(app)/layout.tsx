import { requireActivePlayer } from "@/lib/auth";
import { NavBar } from "@/components/NavBar";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const player = await requireActivePlayer();

  return (
    <div className="flex min-h-dvh flex-col">
      <NavBar player={player} />
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 pb-24 pt-4 sm:pb-8">{children}</main>
      <footer className="hidden border-t border-border py-4 text-center text-xs text-muted sm:block">
        Liga de Golf Regulars
      </footer>
    </div>
  );
}
