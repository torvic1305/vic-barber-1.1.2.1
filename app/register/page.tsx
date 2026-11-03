import Link from "next/link";
import { signUp } from "@/app/auth/actions";
import { hasSupabaseConfig } from "@/lib/supabase/config";

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  if (!hasSupabaseConfig()) {
    return (
      <main className="container">
        <p className="setup-notice" role="status">Configura Supabase para habilitar el registro de cuentas.</p>
      </main>
    );
  }

  const params = await searchParams;

  return (
    <main className="container">
      <section className="panel">
        <p className="eyebrow">Primera visita</p>
        <h1>Crear cuenta</h1>
        <p className="muted">Tus datos se guardan en una cuenta protegida, no en este dispositivo.</p>
        {params.error === "invalid" ? (
          <p className="form-error" role="alert">Revisa tu nombre, correo y contraseña. La contraseña debe tener 12 caracteres o más.</p>
        ) : null}
        {params.error === "signup" ? (
          <p className="form-error" role="alert">No se pudo crear la cuenta. Verifica el correo o inténtalo más tarde.</p>
        ) : null}
        {params.error === "setup" ? (
          <p className="form-error" role="alert">El sitio todavía no configuró su URL pública para confirmar cuentas.</p>
        ) : null}
        <form action={signUp}>
          <div className="field">
            <label htmlFor="name">Nombre</label>
            <input id="name" name="name" autoComplete="name" minLength={2} maxLength={100} required />
          </div>
          <div className="field">
            <label htmlFor="phone">Teléfono <span className="muted">(opcional)</span></label>
            <input id="phone" name="phone" type="tel" autoComplete="tel" maxLength={30} />
          </div>
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
              autoComplete="new-password"
              minLength={12}
              required
            />
            <p className="form-help">Usa al menos 12 caracteres.</p>
          </div>
          <button className="button button-primary" type="submit">Crear cuenta</button>
        </form>
        <p className="form-help">¿Ya tienes cuenta? <Link href="/login">Inicia sesión</Link>.</p>
      </section>
    </main>
  );
}
