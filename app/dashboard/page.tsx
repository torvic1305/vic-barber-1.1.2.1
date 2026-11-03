import { redirect } from "next/navigation";
import { signOut } from "@/app/auth/actions";
import { createService } from "@/app/dashboard/actions";
import { requireUser } from "@/lib/auth";
import { hasSupabaseConfig } from "@/lib/supabase/config";

const errors: Record<string, string> = {
  logout: "No se pudo cerrar la sesión. Inténtalo otra vez.",
  forbidden: "Tu cuenta no tiene permiso para esa acción.",
  "invalid-service": "Revisa el nombre, precio y duración del servicio.",
  "service-save": "No se pudo guardar el servicio.",
};
const statusLabels: Record<string, string> = {
  pending: "Pendiente",
  confirmed: "Confirmada",
  completed: "Completada",
  cancelled: "Cancelada",
};

export const dynamic = "force-dynamic";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; notice?: string }>;
}) {
  if (!hasSupabaseConfig()) {
    return (
      <main className="container">
        <p className="setup-notice" role="status">Configura Supabase para consultar tu agenda.</p>
      </main>
    );
  }

  const { supabase, user, profile } = await requireUser();
  if (!["client", "staff", "admin"].includes(profile.role)) {
    redirect("/");
  }

  const [appointmentsResult, params] = await Promise.all([
    supabase
      .from("appointments")
      .select("id, service_name, staff_name, customer_name, start_at, status, price, duration_minutes")
      .gte("start_at", new Date().toISOString())
      .in("status", ["pending", "confirmed"])
      .order("start_at", { ascending: true })
      .limit(100),
    searchParams,
  ]);

  if (appointmentsResult.error) {
    throw new Error("No se pudieron cargar las citas.");
  }

  const { data: settings, error: settingsError } = await supabase
    .from("shop_settings")
    .select("timezone")
    .eq("id", 1)
    .single();

  if (settingsError) {
    throw new Error("No se pudo cargar la zona horaria del negocio.");
  }

  const errorMessage = params.error ? errors[params.error] : undefined;
  const noticeMessages: Record<string, string> = {
    booked: "Tu cita quedó registrada. Revisa su estado en esta agenda.",
    "service-added": "El servicio se agregó al catálogo.",
  };
  const noticeMessage = params.notice ? noticeMessages[params.notice] : undefined;

  return (
    <main className="container">
      <section className="panel">
        <p className="eyebrow">Mi cuenta</p>
        <h1>Hola, {profile.display_name}</h1>
        <p className="muted">{user.email} · {profile.role}</p>
        {errorMessage ? <p className="form-error" role="alert">{errorMessage}</p> : null}
        {noticeMessage ? <p className="form-notice" role="status">{noticeMessage}</p> : null}
        <form action={signOut}>
          <button type="submit">Cerrar sesión</button>
        </form>
      </section>

      <section className="panel section">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Agenda</p>
            <h2>{profile.role === "client" ? "Mis próximas citas" : "Citas asignadas"}</h2>
          </div>
          {profile.role === "client" ? <a className="button button-primary" href="/book">Nueva cita</a> : null}
        </div>
        {appointmentsResult.data.length === 0 ? (
          <p className="muted">No hay citas para mostrar.</p>
        ) : (
          <div className="table-wrap">
            <table className="appointments">
              <thead>
                <tr>
                  {profile.role !== "client" ? <th>Cliente</th> : null}
                  <th>Fecha</th>
                  <th>Servicio</th>
                  <th>Barbero</th>
                  <th>Precio</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                {appointmentsResult.data.map((appointment) => (
                  <tr key={appointment.id}>
                    {profile.role !== "client" ? <td>{appointment.customer_name}</td> : null}
                    <td>{new Intl.DateTimeFormat("es-MX", {
                      dateStyle: "medium",
                      timeStyle: "short",
                      timeZone: settings.timezone,
                    }).format(new Date(appointment.start_at))}</td>
                    <td>{appointment.service_name} <span className="muted">· {appointment.duration_minutes} min</span></td>
                    <td>{appointment.staff_name}</td>
                    <td>{new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(appointment.price)}</td>
                    <td><span className="status">{statusLabels[appointment.status] || "Pendiente"}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {profile.role === "admin" || profile.role === "staff" ? (
        <section className="panel section">
          <p className="eyebrow">Operación</p>
          <h2>Ventas e inventario</h2>
          <div className="button-row">
            <a className="button button-primary" href="/sales">Punto de venta</a>
            {profile.role === "admin" ? (
              <>
                <a className="button" href="/inventory">Inventario</a>
                <a className="button" href="/cash">Corte de caja</a>
              </>
            ) : null}
          </div>
        </section>
      ) : null}

      {profile.role === "admin" ? (
        <section className="panel section">
          <p className="eyebrow">Administración</p>
          <h2>Agregar servicio</h2>
          {params.error === "invalid-service" || params.error === "service-save" ? (
            <p className="form-error" role="alert">{errors[params.error]}</p>
          ) : null}
          <form action={createService}>
            <div className="field">
              <label htmlFor="name">Nombre del servicio</label>
              <input id="name" name="name" maxLength={100} required />
            </div>
            <div className="field">
              <label htmlFor="description">Descripción</label>
              <input id="description" name="description" maxLength={500} />
            </div>
            <div className="field">
              <label htmlFor="price">Precio en MXN</label>
              <input id="price" name="price" type="number" min="0" max="100000" step="0.01" required />
            </div>
            <div className="field">
              <label htmlFor="duration_minutes">Duración en minutos</label>
              <input id="duration_minutes" name="duration_minutes" type="number" min="5" max="480" step="5" required />
            </div>
            <button className="button button-primary" type="submit">Guardar servicio</button>
          </form>
        </section>
      ) : null}

      {profile.role === "staff" ? (
        <p className="setup-notice">Tu agenda está protegida por tu cuenta. Para asignarte servicios, el administrador debe completar el perfil del equipo en Supabase.</p>
      ) : null}
    </main>
  );
}
