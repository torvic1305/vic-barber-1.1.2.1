import { randomUUID } from "node:crypto";
import { redirect } from "next/navigation";
import { closeCash, createCashExpense } from "@/app/cash/actions";
import { dateInTimeZone, formatMoney } from "@/lib/dates";
import { requireUser } from "@/lib/auth";
import { hasSupabaseConfig } from "@/lib/supabase/config";

type CashSummary = {
  cash_sales: number | string;
  card_sales: number | string;
  cash_expenses: number | string;
  card_expenses: number | string;
};

const errors: Record<string, string> = {
  "invalid-expense": "Revisa la descripción, fecha, monto y forma de pago del gasto.",
  expense: "No se pudo registrar el gasto.",
  closed: "La fecha seleccionada ya tiene un cierre y no admite movimientos nuevos.",
  "invalid-close": "Revisa la fecha, el fondo inicial y el efectivo contado.",
  "already-closed": "La caja de esa fecha ya fue cerrada y no se puede volver a cerrar.",
  close: "No se pudo cerrar la caja.",
};
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const dynamic = "force-dynamic";

export default async function CashPage({
  searchParams,
}: {
  searchParams: Promise<{
    error?: string;
    notice?: string;
    request_id?: string;
    description?: string;
    amount?: string;
    payment_method?: string;
  }>;
}) {
  if (!hasSupabaseConfig()) {
    return <main className="container"><p className="setup-notice">Configura Supabase para operar la caja.</p></main>;
  }

  const { supabase, profile } = await requireUser();
  if (profile.role !== "admin") {
    redirect("/dashboard?error=forbidden");
  }

  const { data: settings, error: settingsError } = await supabase
    .from("shop_settings")
    .select("timezone")
    .eq("id", 1)
    .single();
  if (settingsError) throw new Error("No se pudo consultar la zona horaria del negocio.");

  const today = dateInTimeZone(settings.timezone);
  const [summaryResult, todayExpensesResult, closuresResult, params] = await Promise.all([
    supabase.rpc("get_cash_summary", { p_business_date: today }),
    supabase.from("cash_expenses").select("request_id, description, amount, payment_method, created_at")
      .eq("business_date", today).order("created_at", { ascending: false }),
    supabase.from("cash_closings").select("business_date, opening_float, cash_sales, cash_expenses, card_sales, card_expenses, expected_cash, counted_cash, difference, created_at")
      .order("business_date", { ascending: false }).limit(30),
    searchParams,
  ]);
  if (summaryResult.error || todayExpensesResult.error || closuresResult.error) {
    throw new Error("No se pudo cargar el corte de caja.");
  }

  const summary = summaryResult.data as CashSummary;
  const currentClose = closuresResult.data.find((item) => item.business_date === today);
  const validRequestId = params.request_id && uuidPattern.test(params.request_id) ? params.request_id : null;
  const savedExpense = validRequestId
    ? todayExpensesResult.data.find((expense) => expense.request_id === validRequestId)
    : undefined;

  return (
    <main className="container">
      <section className="panel panel-wide">
        <p className="eyebrow">Caja · {today}</p>
        <h1>Corte de caja</h1>
        <p className="muted">
          Efectivo esperado = fondo inicial + ventas en efectivo (incluye propinas) − gastos pagados en efectivo.
          Tarjeta y gastos con tarjeta se reportan por separado.
        </p>
        {params.error && !savedExpense && errors[params.error] ? <p className="form-error" role="alert">{errors[params.error]}</p> : null}
        {savedExpense ? <p className="form-notice" role="status">El gasto de {formatMoney(savedExpense.amount)} ya quedó registrado; no lo vuelvas a capturar.</p> : null}
        {params.notice === "expense" ? <p className="form-notice" role="status">Gasto registrado.</p> : null}
        {params.notice === "closed" ? <p className="form-notice" role="status">Cierre guardado. Un reintento devuelve el mismo cierre.</p> : null}

        <div className="table-wrap">
          <table className="appointments">
            <tbody>
              <tr><th>Ventas en efectivo (incluye propinas)</th><td>{formatMoney(summary.cash_sales)}</td></tr>
              <tr><th>Ventas con tarjeta</th><td>{formatMoney(summary.card_sales)}</td></tr>
              <tr><th>Gastos en efectivo</th><td>{formatMoney(summary.cash_expenses)}</td></tr>
              <tr><th>Gastos con tarjeta</th><td>{formatMoney(summary.card_expenses)}</td></tr>
              {currentClose ? (
                <>
                  <tr><th>Fondo inicial</th><td>{formatMoney(currentClose.opening_float)}</td></tr>
                  <tr><th>Efectivo esperado</th><td><strong>{formatMoney(currentClose.expected_cash)}</strong></td></tr>
                  <tr><th>Efectivo contado</th><td>{formatMoney(currentClose.counted_cash)}</td></tr>
                  <tr>
                    <th>Diferencia (contado − esperado)</th>
                    <td>
                      <strong>
                        {Number(currentClose.difference) === 0
                          ? "Caja cuadra"
                          : `${Number(currentClose.difference) > 0 ? "Sobra" : "Falta"} ${formatMoney(Math.abs(Number(currentClose.difference)))}`}
                      </strong>
                    </td>
                  </tr>
                </>
              ) : null}
            </tbody>
          </table>
        </div>

        {currentClose ? (
          <p className="setup-notice" role="status">
            Caja cerrada. Los nuevos cobros y gastos de hoy están bloqueados para mantener el corte conciliable.
          </p>
        ) : (
          <form action={closeCash} className="section">
            <input type="hidden" name="business_date" value={today} />
            <div className="form-grid">
              <div className="field">
                <label htmlFor="opening_float">Fondo inicial (MXN)</label>
                <input id="opening_float" name="opening_float" type="number" min="0" max="10000000" step="0.01" defaultValue="0" required />
              </div>
              <div className="field">
                <label htmlFor="counted_cash">Efectivo contado (MXN)</label>
                <input id="counted_cash" name="counted_cash" type="number" min="0" max="10000000" step="0.01" required />
              </div>
            </div>
            <button className="button button-primary" type="submit">Guardar cierre del día</button>
          </form>
        )}
      </section>

      {!currentClose && !savedExpense ? (
        <section className="panel panel-wide section">
          <h2>Registrar gasto</h2>
          <p className="muted">Selecciona cómo se pagó; solo el efectivo reduce el efectivo esperado.</p>
          <form action={createCashExpense}>
            <input
              type="hidden"
              name="request_id"
              value={validRequestId || randomUUID()}
            />
            <input type="hidden" name="business_date" value={today} />
            <div className="form-grid">
              <div className="field">
                <label htmlFor="description">Concepto</label>
                <input id="description" name="description" minLength={2} maxLength={200} defaultValue={params.description || ""} required />
              </div>
              <div className="field">
                <label htmlFor="amount">Monto (MXN)</label>
                <input id="amount" name="amount" type="number" min="0.01" max="10000000" step="0.01" defaultValue={params.amount || ""} required />
              </div>
              <div className="field">
                <label htmlFor="expense_payment_method">Forma de pago</label>
                <select id="expense_payment_method" name="payment_method" defaultValue={params.payment_method === "card" ? "card" : "cash"}>
                  <option value="cash">Efectivo</option>
                  <option value="card">Tarjeta</option>
                </select>
              </div>
            </div>
            <button type="submit">Registrar gasto</button>
          </form>
        </section>
      ) : null}

      {todayExpensesResult.data.length ? (
        <section className="panel panel-wide section">
          <h2>Gastos de hoy</h2>
          <div className="table-wrap">
            <table className="appointments">
              <thead><tr><th>Concepto</th><th>Pago</th><th>Monto</th></tr></thead>
              <tbody>
                {todayExpensesResult.data.map((expense, index) => (
                  <tr key={`${expense.created_at}-${index}`}>
                    <td>{expense.description}</td>
                    <td>{expense.payment_method === "cash" ? "Efectivo" : "Tarjeta"}</td>
                    <td>{formatMoney(expense.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      <section className="panel panel-wide section">
        <h2>Historial de cierres</h2>
        {closuresResult.data.length === 0 ? <p className="muted">Todavía no hay cierres guardados.</p> : (
          <div className="table-wrap">
            <table className="appointments">
              <thead><tr><th>Fecha</th><th>Fondo</th><th>Efectivo esperado</th><th>Contado</th><th>Diferencia</th><th>Ventas tarjeta</th><th>Gastos tarjeta</th></tr></thead>
              <tbody>
                {closuresResult.data.map((closing) => (
                  <tr key={closing.business_date}>
                    <td>{closing.business_date}</td>
                    <td>{formatMoney(closing.opening_float)}</td>
                    <td>{formatMoney(closing.expected_cash)}</td>
                    <td>{formatMoney(closing.counted_cash)}</td>
                    <td>{formatMoney(closing.difference)}</td>
                    <td>{formatMoney(closing.card_sales)}</td>
                    <td>{formatMoney(closing.card_expenses)}</td>
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
