"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function createAppointment(formData: FormData) {
  const serviceId = String(formData.get("service_id") || "");
  const staffId = String(formData.get("staff_id") || "");
  const date = String(formData.get("date") || "");
  const time = String(formData.get("time") || "");
  const requestId = String(formData.get("request_id") || "");

  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(serviceId) ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(staffId) ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(requestId) ||
    !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
    !/^\d{2}:\d{2}$/.test(time)
  ) {
    redirect("/book?error=invalid");
  }

  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    redirect("/login?next=%2Fbook");
  }

  const { error } = await supabase.rpc("create_appointment_idempotent", {
    p_service_id: serviceId,
    p_staff_id: staffId,
    p_start_local: `${date} ${time}:00`,
    p_request_id: requestId,
  });

  if (error) {
    const reason = error.code === "23P01" ? "busy" : "unavailable";
    redirect(
      `/book?error=${reason}&request_id=${requestId}&service_id=${serviceId}&staff_id=${staffId}&date=${date}&time=${time}`,
    );
  }

  redirect("/dashboard?notice=booked");
}
