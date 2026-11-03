import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error) {
    throw new Error("No se pudo verificar la sesión.");
  }

  if (!user) {
    redirect("/login?next=%2Fdashboard");
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role, display_name")
    .eq("id", user.id)
    .single();

  if (profileError || !profile) {
    throw new Error("No se pudo cargar el perfil de la cuenta.");
  }

  return { supabase, user, profile };
}

