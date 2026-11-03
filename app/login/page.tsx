import Link from "next/link";
import { signIn } from "@/app/auth/actions";
import { hasSupabaseConfig } from "@/lib/supabase/config";

const errorMessages: Record<string, string> = {
  invalid: "Escribe un correo válido y una contraseña de al menos 12 caracteres.",
  credentials: "No pudimos iniciar sesión con esos datos.",
  callback: "No se pudo confirmar la cuenta. Solicita un nuevo enlace de confirmación.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; notice?: string; next?: string }>;
}) {
  if (!hasSupabaseConfig()) {
    return (
      <main className="container">
        <p className="setup-notice" role="status">Configura Supabase para habilitar el inicio de sesión.</p>
      </main>
    );
  }

  const params = await searchParams;
  const errorMessage = params.error ? errorMessages[params.error] : undefined;

  return (
    <main className="container">
      <section className="panel">
        <p className="eyebrow">Tu cuenta</p>
        <h1>Iniciar sesión</h1>
        <p className="muted">Accede para reservar y consultar tus citas.</p>
        {errorMessage ? <p className="form-error" role="alert">{errorMessage}</p> : null}
        {params.notice === "confirm" ? (
          <p className="form-notice" role="status">Revisa tu correo para confirmar la cuenta y después inicia sesión.</p>
        ) : null}
        <form action={signIn}>
          <input type="hidden" name="next" value={params.next || "/dashboard"} />
          <div className="field">
            <label htmlFor="email">Correo</label>
            <input id="email" name="email" type="email" autoComplete="email" required />
          </div>
          <div className="field">
            <label htmlFor="password">Contraseña</label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              minLength={12}
              required
            />
          </div>
          <button className="button button-primary" type="submit">Entrar</button>
        </form>
        <p className="form-help">
          ¿Aún no tienes cuenta? <Link href="/register">Regístrate</Link>.
        </p>
      </section>
    </main>
  );
}
