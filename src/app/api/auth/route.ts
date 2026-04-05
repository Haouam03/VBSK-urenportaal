import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function POST(req: NextRequest) {
  const { name, pin } = await req.json();

  const { data: trainer, error } = await supabase
    .from("trainers")
    .select("id, name, role")
    .eq("name", name)
    .eq("pin", pin)
    .eq("active", true)
    .single();

  if (error || !trainer) {
    return NextResponse.json({ error: "Ongeldige naam of pincode" }, { status: 401 });
  }

  return NextResponse.json(trainer);
}
