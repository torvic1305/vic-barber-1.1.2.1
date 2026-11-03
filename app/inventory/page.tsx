import { randomUUID } from "node:crypto";
import { redirect } from "next/navigation";
import { InventoryImporter } from "@/app/inventory/importer";
import { formatMoney } from "@/lib/dates";
import { requireUser } from "@/lib/auth";
import { hasSupabaseConfig } from "@/lib/supabase/config";

const errors: Record<string, string> = {
  invalid: "El archivo no coincide con el formato esperado. Revisa las columnas y cantidades.",
  duplicate: "El archivo contiene SKU/códigos repetidos; no se aplicó ningún cambio.",
  save: "No se pudo guardar la importación. No se aplicaron cambios.",
};
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const dynamic = "force-dynamic";

export default async function InventoryPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; notice?: string; request_id?: string }>;
}) {
  if (!hasSupabaseConfig()) {
    return <main className="container"><p className="setup-notice">Configura Supabase para administrar el inventario.</p></main>;
  }

  const { supabase, user, profile } = await requireUser();
  if (profile.role !== "admin") {
    redirect("/dashboard?error=forbidden");
  }

  const [productsResult, params] = await Promise.all([
    supabase.from("products").select("sku, name, price, cost, stock, min_stock, is_active").order("name"),
    searchParams,
  ]);
  if (productsResult.error) throw new Error("No se pudo cargar el inventario.");
  const validRequestId = params.request_id && uuidPattern.test(params.request_id) ? params.request_id : null;
  const { data: savedImport, error: importResultError } = validRequestId
    ? await supabase.from("inventory_imports").select("result")
      .eq("imported_by", user.id).eq("request_id", validRequestId).maybeSingle()
    : { data: null, error: null };
  if (importResultError) throw new Error("No se pudo comprobar el resultado de la importación.");

  return (
    <main className="container">
      <section className="panel panel-wide">
        <p className="eyebrow">Inventario</p>
        <h1>Importar productos</h1>
        <p className="muted">
          Cada SKU/código identifica un producto. Si ya existe, se actualizan sus datos y existencias;
          si no existe, se crea. Reimportar el archivo no duplica productos.
        </p>
        {params.error && !savedImport && errors[params.error] ? <p className="form-error" role="alert">{errors[params.error]}</p> : null}
        {params.notice === "imported" ? <p className="form-notice" role="status">Inventario importado y actualizado.</p> : null}
        {savedImport ? (
          <p className="form-notice" role="status">
            Esta importación ya quedó guardada ({savedImport.result.inserted} nuevos, {savedImport.result.updated} actualizados). No la repitas.
          </p>
        ) : (
          <InventoryImporter requestId={validRequestId || randomUUID()} />
        )}
        <p className="form-help">
          <a download="plantilla-inventario.csv" href="data:text/csv;charset=utf-8,sku%2Cname%2Cprice%2Ccost%2Cstock%2Cmin_stock%0A">
            Descargar plantilla CSV
          </a>
        </p>
      </section>

      <section className="panel panel-wide section">
        <h2>Existencias</h2>
        {productsResult.data.length === 0 ? <p className="muted">Aún no hay productos. Importa tu primer archivo.</p> : (
          <div className="table-wrap">
            <table className="appointments">
              <thead><tr><th>SKU/código</th><th>Producto</th><th>Precio</th><th>Costo</th><th>Stock</th><th>Mínimo</th><th>Estado</th></tr></thead>
              <tbody>
                {productsResult.data.map((product) => (
                  <tr key={product.sku}>
                    <td>{product.sku}</td>
                    <td>{product.name}</td>
                    <td>{formatMoney(product.price)}</td>
                    <td>{formatMoney(product.cost)}</td>
                    <td>{product.stock}</td>
                    <td>{product.min_stock}</td>
                    <td>{!product.is_active ? "Inactivo" : product.stock <= product.min_stock ? "Stock bajo" : "Disponible"}</td>
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
