"use server";

import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";

export async function createService(formData: FormData) {
  const { supabase, profile } = await requireUser();
  if (profile.role !== "admin") {
    redirect("/dashboard?error=forbidden");
  }

  const name = String(formData.get("name") || "").trim();
  const description = String(formData.get("description") || "").trim();
  const price = Number(formData.get("price"));
  const duration = Number(formData.get("duration_minutes"));

  if (
    name.length < 2 ||
    name.length > 100 ||
    !Number.isFinite(price) ||
    price < 0 ||
    price > 100000 ||
    !Number.isInteger(duration) ||
    duration < 5 ||
    duration > 480
  ) {
    redirect("/dashboard?error=invalid-service");
  }

  const { error } = await supabase.from("services").insert({
    name,
    description: description.slice(0, 500) || null,
    price,
    duration_minutes: duration,
  });

  if (error) {
    redirect("/dashboard?error=service-save");
  }

  redirect("/dashboard?notice=service-added");
}

