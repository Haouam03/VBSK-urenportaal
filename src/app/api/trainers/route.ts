import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function GET() {
  const { data } = await supabase
    .from("trainers")
    .select("id, name, role, active")
    .order("name");

  return NextResponse.json(data || []);
}

export async function POST(req: NextRequest) {
  const { name, pin, role } = await req.json();

  const { data, error } = await supabase
    .from("trainers")
    .insert({ name, pin, role: role || "trainer" })
    .select("id, name, role")
    .single();

  if (error) {
    return NextResponse.json({ error: "Trainer bestaat al" }, { status: 400 });
  }

  return NextResponse.json(data);
}

export async function PUT(req: NextRequest) {
  const { id, name, pin, active } = await req.json();

  const updates: Record<string, unknown> = {};
  if (name !== undefined) updates.name = name;
  if (pin !== undefined) updates.pin = pin;
  if (active !== undefined) updates.active = active;

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "Geen wijzigingen" }, { status: 400 });
  }

  await supabase.from("trainers").update(updates).eq("id", id);
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const { id } = await req.json();
  await supabase.from("trainers").update({ active: false }).eq("id", id);
  return NextResponse.json({ ok: true });
}
