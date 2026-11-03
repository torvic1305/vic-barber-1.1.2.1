"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type InventoryRow = {
  sku: string;
  name: string;
  price: string;
  cost: string;
  stock: string;
  min_stock: string;
};

function isInventoryRow(value: unknown): value is InventoryRow {
  if (!value || typeof value !== "object") return false;
  const row = value as Record<string, unknown>;
  return ["sku", "name", "price", "cost", "stock", "min_stock"].every(
    (field) => typeof row[field] === "string",
  );
}

function isInventoryRows(value: unknown): value is InventoryRow[] {
  return Array.isArray(value) && value.every(isInventoryRow);
}

export async function importInventory(formData: FormData) {
  const { supabase, profile } = await requireUser();
  if (profile.role !== "admin") {
    redirect("/dashboard?error=forbidden");
  }

  const requestId = String(formData.get("request_id") || "");
  const rawRows = String(formData.get("rows_json") || "");
  if (!uuidPattern.test(requestId) || rawRows.length > 700_000) {
    redirect(`/inventory?error=invalid&request_id=${encodeURIComponent(requestId)}`);
  }

  let parsedRows: unknown;
  try {
    parsedRows = JSON.parse(rawRows);
  } catch {
    redirect(`/inventory?error=invalid&request_id=${requestId}`);
  }

  if (
    !isInventoryRows(parsedRows) ||
    parsedRows.length < 1 ||
    parsedRows.length > 5000
  ) {
    redirect(`/inventory?error=invalid&request_id=${requestId}`);
  }

  const { error } = await supabase.rpc("import_inventory", {
    p_request_id: requestId,
    p_rows: parsedRows,
  });

  if (error) {
    const reason = error.message.includes("SKU")
      ? "duplicate"
      : error.message.includes("inválid")
        ? "invalid"
        : "save";
    redirect(`/inventory?error=${reason}&request_id=${requestId}`);
  }

  revalidatePath("/inventory");
  revalidatePath("/sales");
  redirect("/inventory?notice=imported");
}
