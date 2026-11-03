import Link from "next/link";
import { hasSupabaseConfig } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type Service = {
  id: string;
  name: string;
  description: string | null;
  price: number;
  duration_minutes: number;
};

export default async function HomePage() {
  if (!hasSupabaseConfig()) {
    return (
      <main className="container">
        <section className="hero">
          <p className="eyebrow">Barbería · Cuidado personal</p>
          <h1>Un buen corte cambia el día.</h1>
          <p>Configura tu proyecto de Supabase para publicar el catálogo y habilitar las reservas.</p>
        </section>
        <p className="setup-notice" role="status">
          Falta configurar las variables de Supabase. Sigue las instrucciones de{" "}
          <code>README.md</code>.
        </p>
      </main>
    );
  }

  const supabase = await createClient();
  const [settingsResult, servicesResult] = await Promise.all([
    supabase.from("shop_settings").select("name, address, phone, timezone").eq("id", 1).single(),
    supabase
      .from("services")
      .select("id, name, description, price, duration_minutes")
      .eq("is_active", true)
      .order("sort_order"),
  ]);

  if (settingsResult.error || servicesResult.error) {
    throw new Error("No se pudo cargar el catálogo. Comprueba la migración de Supabase.");
  }

  const shop = settingsResult.data;
  const services = servicesResult.data as Service[];

  return (
    <main className="container">
      <section className="hero">
        <p className="eyebrow">Barbería · Cuidado personal</p>
        <h1>{shop.name}</h1>
        <p>
          Un espacio para renovar tu estilo. Reserva tu visita con nuestro equipo y disfruta de una
          atención hecha a tu medida.
        </p>
        <p className="muted">
          {[shop.address, shop.phone].filter(Boolean).join(" · ") || "Atención con cita"}
        </p>
        <div className="button-row">
          <Link className="button button-primary" href="/book">
            Agenda tu cita
          </Link>
          <Link className="button button-secondary" href="/login">
            Ya tengo cuenta
          </Link>
        </div>
      </section>

      <section className="section" id="servicios">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Nuestro menú</p>
            <h2>Servicios</h2>
          </div>
          <p className="muted">Precios en MXN · Horario local: {shop.timezone}</p>
        </div>
        {services.length === 0 ? (
          <p className="panel muted">Aún no hay servicios publicados. El administrador puede agregarlos desde su panel.</p>
        ) : (
          <div className="service-grid">
            {services.map((service) => (
              <article className="service-card" key={service.id}>
                <h3>{service.name}</h3>
                <p className="muted">{service.description || "Servicio profesional en barbería."}</p>
                <div className="service-meta">
                  <span className="muted">{service.duration_minutes} min</span>
                  <span className="service-price">
                    {new Intl.NumberFormat("es-MX", {
                      style: "currency",
                      currency: "MXN",
                      maximumFractionDigits: 0,
                    }).format(service.price)}
                  </span>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
