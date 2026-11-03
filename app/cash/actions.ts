"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const datePattern = /^\d{4}-\d{2}-\d{2}$/;

export async function createCashExpense(formData: FormData) {
  const { supabase, profile } = await requireUser();
  if (profile.role !== "admin") {
    redirect("/dashboard?error=forbidden");
  }

  const requestId = String(formData.get("request_id") || "");
  const date = String(formData.get("business_date") || "");
  const description = String(formData.get("description") || "").trim();
  const rawAmount = String(formData.get("amount") || "");
  const amount = Number(rawAmount);
  const paymentMethod = String(formData.get("payment_method") || "");

  if (
    !uuidPattern.test(requestId) ||
    !datePattern.test(date) ||
    description.length < 2 ||
    description.length > 200 ||
    !/^\d+(\.\d{1,2})?$/.test(rawAmount) ||
    !Number.isFinite(amount) ||
    amount <= 0 ||
    amount > 10_000_000 ||
    (paymentMethod !== "cash" && paymentMethod !== "card")
  ) {
    redirect(`/cash?error=invalid-expense&request_id=${encodeURIComponent(requestId)}`);
  }

  const { error } = await supabase.rpc("create_cash_expense", {
    p_request_id: requestId,
    p_business_date: date,
    p_description: description,
    p_amount: amount,
    p_payment_method: paymentMethod,
  });

  if (error) {
    const reason = error.message.includes("cerrada") ? "closed" : "expense";
    redirect(
      `/cash?error=${reason}&request_id=${requestId}&description=${encodeURIComponent(description)}&amount=${amount}&payment_method=${paymentMethod}`,
    );
  }

  revalidatePath("/cash");
  redirect("/cash?notice=expense");
}

export async function closeCash(formData: FormData) {
  const { supabase, profile } = await requireUser();
  if (profile.role !== "admin") {
    redirect("/dashboard?error=forbidden");
  }

  const date = String(formData.get("business_date") || "");
  const rawOpeningFloat = String(formData.get("opening_float") || "");
  const rawCountedCash = String(formData.get("counted_cash") || "");
  const openingFloat = Number(rawOpeningFloat);
  const countedCash = Number(rawCountedCash);
  if (
    !datePattern.test(date) ||
    !/^\d+(\.\d{1,2})?$/.test(rawOpeningFloat) ||
    !/^\d+(\.\d{1,2})?$/.test(rawCountedCash) ||
    !Number.isFinite(openingFloat) ||
    openingFloat < 0 ||
    openingFloat > 10_000_000 ||
    !Number.isFinite(countedCash) ||
    countedCash < 0 ||
    countedCash > 10_000_000
  ) {
    redirect("/cash?error=invalid-close");
  }

  const { error } = await supabase.rpc("close_cash", {
    p_business_date: date,
    p_opening_float: openingFloat,
    p_counted_cash: countedCash,
  });

  if (error) {
    const reason = error.message.includes("cerrar") || error.message.includes("cerrada")
      ? "already-closed"
      : "close";
    redirect(`/cash?error=${reason}`);
  }

  revalidatePath("/cash");
  revalidatePath("/sales");
  redirect("/cash?notice=closed");
}
