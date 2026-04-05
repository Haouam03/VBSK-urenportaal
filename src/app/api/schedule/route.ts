import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function GET() {
  const { data } = await supabase
    .from("schedule")
    .select("*, trainers(name)")
    .order("day_of_week")
    .order("start_time");

  const slots = (data || []).map((s) => ({
    ...s,
    trainer_name: (s.trainers as { name: string })?.name || "",
    trainers: undefined,
  }));

  return NextResponse.json(slots);
}

export async function POST(req: NextRequest) {
  const { day_of_week, start_time, end_time, location, trainer_id } = await req.json();

  const { data } = await supabase
    .from("schedule")
    .insert({ day_of_week, start_time, end_time, location: location || "", trainer_id })
    .select("id")
    .single();

  return NextResponse.json({ id: data?.id });
}

export async function PUT(req: NextRequest) {
  const { id, day_of_week, start_time, end_time, location, trainer_id } = await req.json();

  await supabase
    .from("schedule")
    .update({ day_of_week, start_time, end_time, location: location || "", trainer_id })
    .eq("id", id);

  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const { id } = await req.json();
  await supabase.from("schedule").delete().eq("id", id);
  return NextResponse.json({ ok: true });
}
