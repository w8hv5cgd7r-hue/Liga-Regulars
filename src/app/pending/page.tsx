import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { signOutAction } from "@/lib/actions/auth-actions";

export default async function PendingPage({
  searchParams,
}: PageProps<"/pending">) {
  const params = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: player } = await supabase
    .from("players")
    .select("status")
    .eq("id", user.id)
    .single();

  if (player?.status === "active") redirect("/");

  const inactive = params?.inactive === "1";

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col items-center justify-center px-6 py-10 text-center">
      <div className="mb-2 text-4xl" aria-hidden>
        {inactive ? "⛔" : "⏳"}
      </div>
      <h1 className="text-xl font-bold text-primary-dark">
        {inactive ? "Cuenta desactivada" : "Cuenta pendiente de activación"}
      </h1>
      <p className="mt-2 text-sm text-muted">
        {inactive
          ? "Tu cuenta está desactivada. Habla con el administrador de la liga si crees que es un error."
          : "Un administrador de la liga tiene que activar tu cuenta. Avísale para que lo haga y vuelve a entrar en unos minutos."}
      </p>
      <form action={signOutAction} className="mt-6">
        <button
          type="submit"
          className="rounded-md border border-border px-4 py-2.5 font-medium hover:bg-card"
        >
          Cerrar sesión
        </button>
      </form>
    </main>
  );
}
