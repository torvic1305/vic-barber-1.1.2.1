import { randomUUID } from "node:crypto";
import { redirect } from "next/navigation";
import { createSale } from "@/app/sales/actions";
import { formatMoney } from "@/lib/dates";
import { requireUser } from "@/lib/auth";
import { hasSupabaseConfig } from "@/lib/supabase/config";

const errors: Record<string, string> = {
  invalid: "Revisa los artículos, cantidades, pago y propina.",
  stock: "No hay existencias suficientes; el ticket no se cobró.",
  closed: "La caja de hoy ya se cerró y no acepta más ventas.",
  save: "No se pudo registrar la venta. No se descontó inventario.",
};
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const dynamic = "force-dynamic";

export default async function SalesPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; notice?: string; request_id?: string }>;
}) {
  if (!hasSupabaseConfig()) {
    return <main className="container"><p className="setup-notice">Configura Supabase para registrar ventas.</p></main>;
  }

  const { supabase, profile } = await requireUser();
  if (profile.role !== "admin" && profile.role !== "staff") {
    redirect("/dashboard?error=forbidden");
  }

  const [productsResult, servicesResult, appointmentsResult, salesResult, params] = await Promise.all([
    supabase.from("products").select("id, sku, name, price, stock").eq("is_active", true).order("name"),
    supabase.from("services").select("id, name, price").eq("is_active", true).order("sort_order"),
    supabase.from("appointments").select("id, service_name, customer_name, staff_name, start_at, price")
      .in("status", ["pending", "confirmed"]).lte("start_at", new Date().toISOString())
      .order("start_at", { ascending: false }).limit(100),
    supabase
      .from("sales")
      .select("id, request_id, payment_method, subtotal, tip, total, created_at, sale_items(name, quantity, unit_price)")
      .order("created_at", { ascending: false })
      .limit(30),
    searchParams,
  ]);

  if (productsResult.error || servicesResult.error || appointmentsResult.error || salesResult.error) {
    throw new Error("No se pudieron cargar el catálogo o las ventas.");
  }
  const requestId = params.request_id && uuidPattern.test(params.request_id) ? params.request_id : null;
  const savedRetry = requestId
    ? salesResult.data.find((sale) => sale.request_id === requestId)
    : undefined;

  return (
    <main className="container">
      <section className="panel panel-wide">
        <p className="eyebrow">Punto de venta</p>
        <h1>Registrar venta</h1>
        <p className="muted">El cobro y el descuento de inventario se realizan juntos en PostgreSQL.</p>
        {savedRetry ? (
          <p className="form-notice" role="status">Este cobro ya quedó registrado. No lo vuelvas a capturar.</p>
        ) : params.error && errors[params.error] ? <p className="form-error" role="alert">{errors[params.error]}</p> : null}
        {params.notice === "saved" ? <p className="form-notice" role="status">Venta registrada. Si reenvías la solicitud, no se cobrará dos veces.</p> : null}
        {savedRetry ? <a className="button button-primary" href="/sales">Iniciar otro cobro</a> : null}
        {!savedRetry ? (
        <form action={createSale}>
          <input
            type="hidden"
            name="request_id"
            value={params.request_id && uuidPattern.test(params.request_id) ? params.request_id : randomUUID()}
          />
          <div className="field">
            <label htmlFor="appointment_id">Cobrar una cita (opcional)</label>
            <select id="appointment_id" name="appointment_id" defaultValue="">
              <option value="">Venta nueva, sin cita</option>
              {appointmentsResult.data.map((appointment) => (
                <option key={appointment.id} value={appointment.id}>
                  {new Intl.DateTimeFormat("es-MX", { dateStyle: "short", timeStyle: "short" })
                    .format(new Date(appointment.start_at))} · {appointment.customer_name} · {appointment.service_name}
                </option>
              ))}
            </select>
            <p className="form-help">Al cobrar una cita se usa el precio guardado al reservar y se marca completada. No agregues el servicio otra vez.</p>
          </div>
          <div className="table-wrap">
            <table className="appointments">
              <thead><tr><th>Artículo</th><th>Cantidad</th><th>Stock actual</th></tr></thead>
              <tbody>
                {Array.from({ length: 8 }, (_, index) => (
                  <tr key={index}>
                    <td>
                      <select name={`item_${index}`} aria-label={`Artículo ${index + 1}`} defaultValue="">
                        <option value="">— Sin artículo —</option>
                        {productsResult.data.map((product) => (
                          <option key={`product-${product.id}`} value={`product:${product.id}`} disabled={product.stock < 1}>
                            Producto · {product.name} · {formatMoney(product.price)}
                          </option>
                        ))}
                        {servicesResult.data.map((service) => (
                          <option key={`service-${service.id}`} value={`service:${service.id}`}>
                            Servicio · {service.name} · {formatMoney(service.price)}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td><input aria-label={`Cantidad ${index + 1}`} name={`quantity_${index}`} type="number" min="1" max="1000" defaultValue="1" /></td>
                    <td className="muted">Se valida al cobrar</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="form-grid">
            <div className="field">
              <label htmlFor="payment_method">Forma de pago</label>
              <select id="payment_method" name="payment_method" required defaultValue="cash">
                <option value="cash">Efectivo</option>
                <option value="card">Tarjeta</option>
              </select>
            </div>
            <div className="field">
              <label htmlFor="tip">Propina en MXN</label>
              <input id="tip" name="tip" type="number" min="0" max="10000000" step="0.01" defaultValue="0" required />
            </div>
          </div>
          <button className="button button-primary" type="submit">Cobrar y registrar</button>
        </form>
        ) : null}
      </section>

      <section className="panel panel-wide section">
        <h2>Últimas ventas</h2>
        {salesResult.data.length === 0 ? <p className="muted">Todavía no hay ventas.</p> : (
          <div className="table-wrap">
            <table className="appointments">
              <thead><tr><th>Fecha</th><th>Artículos</th><th>Pago</th><th>Propina</th><th>Total</th></tr></thead>
              <tbody>
                {salesResult.data.map((sale) => (
                  <tr key={sale.id}>
                    <td>{new Intl.DateTimeFormat("es-MX", { dateStyle: "short", timeStyle: "short" }).format(new Date(sale.created_at))}</td>
                    <td>{sale.sale_items.map((item) => `${item.quantity} × ${item.name}`).join(", ")}</td>
                    <td>{sale.payment_method === "cash" ? "Efectivo" : "Tarjeta"}</td>
                    <td>{formatMoney(sale.tip)}</td>
                    <td>{formatMoney(sale.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
