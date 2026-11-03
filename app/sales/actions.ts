"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function createSale(formData: FormData) {
  const { supabase, profile } = await requireUser();
  if (profile.role !== "admin" && profile.role !== "staff") {
    redirect("/dashboard?error=forbidden");
  }

  const requestId = String(formData.get("request_id") || "");
  const paymentMethod = String(formData.get("payment_method") || "");
  const rawTip = String(formData.get("tip") || "");
  const tip = Number(rawTip);
  const appointmentId = String(formData.get("appointment_id") || "");
  const items: Array<{ kind: "product" | "service"; id: string; quantity: number }> = [];
  if (appointmentId && !uuidPattern.test(appointmentId)) {
    redirect(`/sales?error=invalid&request_id=${encodeURIComponent(requestId)}`);
  }

  for (let index = 0; index < 8; index += 1) {
    const selection = String(formData.get(`item_${index}`) || "");
    if (!selection) continue;

    const [kind, id] = selection.split(":");
    const quantity = Number(formData.get(`quantity_${index}`));
    if (
      (kind !== "product" && kind !== "service") ||
      !uuidPattern.test(id || "") ||
      !Number.isInteger(quantity) ||
      quantity < 1 ||
      quantity > 1000
    ) {
      redirect(`/sales?error=invalid&request_id=${encodeURIComponent(requestId)}`);
    }

    items.push({ kind, id, quantity });
  }

  if (
    !uuidPattern.test(requestId) ||
    (paymentMethod !== "cash" && paymentMethod !== "card") ||
    !/^\d+(\.\d{1,2})?$/.test(rawTip) ||
    !Number.isFinite(tip) ||
    tip < 0 ||
    tip > 10_000_000 ||
    (items.length === 0 && !appointmentId)
  ) {
    redirect(`/sales?error=invalid&request_id=${encodeURIComponent(requestId)}`);
  }

  const { error } = await supabase.rpc("create_sale", {
    p_request_id: requestId,
    p_payment_method: paymentMethod,
    p_tip: tip,
    p_items: items,
    p_appointment_id: appointmentId || null,
  });

  if (error) {
    const reason = error.message.includes("existencias")
      ? "stock"
      : error.message.includes("cerr")
        ? "closed"
        : "save";
    redirect(`/sales?error=${reason}&request_id=${requestId}`);
  }

  revalidatePath("/sales");
  revalidatePath("/inventory");
  revalidatePath("/cash");
  redirect("/sales?notice=saved");
}
