import { randomUUID } from "node:crypto";
import { redirect } from "next/navigation";
import { createAppointment } from "@/app/book/actions";
import { createClient } from "@/lib/supabase/server";
import { hasSupabaseConfig } from "@/lib/supabase/config";

const errors: Record<string, string> = {
  invalid: "Revisa los datos seleccionados.",
  busy: "Ese horario acaba de ocuparse. Elige otra hora.",
  unavailable: "No se pudo reservar. Comprueba el servicio y el horario e inténtalo de nuevo.",
};

export const dynamic = "force-dynamic";

export default async function BookPage({
  searchParams,
}: {
  searchParams: Promise<{
    error?: string;
    request_id?: string;
    service_id?: string;
    staff_id?: string;
    date?: string;
    time?: string;
  }>;
}) {
  if (!hasSupabaseConfig()) {
    return (
      <main className="container">
        <p className="setup-notice" role="status">Configura Supabase para activar las reservas.</p>
      </main>
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError) {
    throw new Error("No se pudo verificar la sesión.");
  }
  if (!user) {
    redirect("/login?next=%2Fbook");
  }

  const [servicesResult, staffResult, settingsResult, params] = await Promise.all([
    supabase.from("services").select("id, name, duration_minutes, price").eq("is_active", true).order("sort_order"),
    supabase.from("staff_public").select("id, display_name").eq("is_active", true).order("display_name"),
    supabase.from("shop_settings").select("timezone").eq("id", 1).single(),
    searchParams,
  ]);

  if (servicesResult.error || staffResult.error || settingsResult.error) {
    throw new Error("No se pudieron cargar los datos de la agenda.");
  }

  const services = servicesResult.data;
  const staff = staffResult.data;
  const errorMessage = params.error ? errors[params.error] : undefined;
  const validRequestId =
    params.request_id &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(params.request_id)
      ? params.request_id
      : null;
  if (params.error && validRequestId) {
    const { data: savedAppointmentId, error } = await supabase.rpc("get_appointment_request", {
      p_request_id: validRequestId,
    });
    if (error) throw new Error("No se pudo comprobar el resultado de la reserva.");
    if (savedAppointmentId) redirect("/dashboard?notice=booked");
  }
  const requestId =
    validRequestId
      ? validRequestId
      : randomUUID();
  const selectedService = services.some((service) => service.id === params.service_id) ? params.service_id : "";
  const selectedStaff = staff.some((member) => member.id === params.staff_id) ? params.staff_id : "";

  return (
    <main className="container">
      <section className="panel">
        <p className="eyebrow">Reserva en línea</p>
        <h1>Agenda tu cita</h1>
        <p className="muted">Las fechas y horas se interpretan en la zona horaria del negocio: {settingsResult.data.timezone}.</p>
        {errorMessage ? <p className="form-error" role="alert">{errorMessage}</p> : null}
        {services.length === 0 || staff.length === 0 ? (
          <p className="setup-notice" role="status">El negocio aún debe publicar servicios y asignar personal a la agenda.</p>
        ) : (
          <form action={createAppointment}>
            <input type="hidden" name="request_id" value={requestId} />
            <div className="field">
              <label htmlFor="service_id">Servicio</label>
              <select id="service_id" name="service_id" required defaultValue={selectedService}>
                <option value="" disabled>Elige un servicio</option>
                {services.map((service) => (
                  <option key={service.id} value={service.id}>
                    {service.name} · {service.duration_minutes} min · ${service.price} MXN
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="staff_id">Barbero</label>
              <select id="staff_id" name="staff_id" required defaultValue={selectedStaff}>
                <option value="" disabled>Elige un profesional</option>
                {staff.map((member) => (
                  <option key={member.id} value={member.id}>{member.display_name}</option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="date">Fecha (hora local del negocio)</label>
              <input id="date" name="date" type="date" defaultValue={/^\d{4}-\d{2}-\d{2}$/.test(params.date || "") ? params.date : undefined} required />
            </div>
            <div className="field">
              <label htmlFor="time">Hora</label>
              <input id="time" name="time" type="time" defaultValue={/^\d{2}:\d{2}$/.test(params.time || "") ? params.time : undefined} required />
            </div>
            <button className="button button-primary" type="submit">Confirmar cita</button>
          </form>
        )}
      </section>
    </main>
  );
}
