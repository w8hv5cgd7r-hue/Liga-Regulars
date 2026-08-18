"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function SignupPage() {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password.length < 6) {
      setError("La contraseña debe tener al menos 6 caracteres.");
      return;
    }

    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName } },
    });
    setLoading(false);

    if (error) {
      setError(error.message);
      return;
    }
    setDone(true);
  }

  if (done) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-6 py-10 text-center">
        <div className="mb-2 text-4xl" aria-hidden>
          ✅
        </div>
        <h1 className="text-xl font-bold text-primary-dark">¡Cuenta creada!</h1>
        <p className="mt-2 text-sm text-muted">
          Un administrador de la liga tiene que activar tu cuenta antes de que puedas entrar.
          Avísale para que lo haga.
        </p>
        <button
          onClick={() => router.replace("/login")}
          className="mt-6 rounded-md bg-primary px-4 py-2.5 font-medium text-primary-foreground hover:bg-primary-dark"
        >
          Ir a iniciar sesión
        </button>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-6 py-10">
      <div className="mb-8 text-center">
        <div className="mb-2 text-4xl" aria-hidden>
          ⛳
        </div>
        <h1 className="text-2xl font-bold text-primary-dark">Crear cuenta</h1>
        <p className="mt-1 text-sm text-muted">
          Tu cuenta quedará pendiente hasta que el administrador la active.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
        <div className="flex flex-col gap-1">
          <label htmlFor="full_name" className="text-sm font-medium">
            Nombre y apellido
          </label>
          <input
            id="full_name"
            type="text"
            required
            autoComplete="name"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className="rounded-md border border-border bg-card px-3 py-2 text-base"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="email" className="text-sm font-medium">
            Email
          </label>
          <input
            id="email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="rounded-md border border-border bg-card px-3 py-2 text-base"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="password" className="text-sm font-medium">
            Contraseña
          </label>
          <input
            id="password"
            type="password"
            required
            minLength={6}
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="rounded-md border border-border bg-card px-3 py-2 text-base"
          />
        </div>

        {error && (
          <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-danger">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="mt-2 rounded-md bg-primary px-4 py-2.5 font-medium text-primary-foreground hover:bg-primary-dark disabled:opacity-60"
        >
          {loading ? "Creando…" : "Crear cuenta"}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-muted">
        ¿Ya tienes cuenta?{" "}
        <Link href="/login" className="font-medium text-primary underline">
          Inicia sesión
        </Link>
      </p>
    </main>
  );
}
