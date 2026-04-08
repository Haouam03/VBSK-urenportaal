import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const trainerId = searchParams.get("trainer_id");
  const month = searchParams.get("month");
  const status = searchParams.get("status");

  let query = supabase
    .from("hours")
    .select("*, trainers!hours_trainer_id_fkey(name), substitute:trainers!hours_substitute_for_id_fkey(name)")
    .order("date", { ascending: false })
    .order("start_time", { ascending: false });

  if (trainerId) query = query.eq("trainer_id", trainerId);
  if (month) query = query.like("date", `${month}%`);
  if (status) query = query.eq("status", status);

  const { data } = await query;

  const hours = (data || []).map((h) => ({
    ...h,
    trainer_name: (h.trainers as { name: string })?.name || "",
    substitute_for_name: (h.substitute as { name: string })?.name || null,
    trainers: undefined,
    substitute: undefined,
  }));

  return NextResponse.json(hours);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { trainer_id, date, start_time, end_time, type, substitute_for_id, schedule_id, remark } = body;

  // Auto-match schedule if not provided
  let matchedScheduleId = schedule_id || null;
  if (!matchedScheduleId) {
    const dateObj = new Date(date + "T00:00:00");
    const dayOfWeek = dateObj.getDay();
    const { data: match } = await supabase
      .from("schedule")
      .select("id")
      .eq("day_of_week", dayOfWeek)
      .eq("start_time", start_time)
      .eq("end_time", end_time)
      .limit(1)
      .single();
    if (match) matchedScheduleId = match.id;
  }

  const { data } = await supabase
    .from("hours")
    .insert({
      trainer_id,
      date,
      start_time,
      end_time,
      type: type || "regulier",
      substitute_for_id: substitute_for_id || null,
      schedule_id: matchedScheduleId,
      remark: remark || "",
    })
    .select("id")
    .single();

  return NextResponse.json({ id: data?.id });
}

export async function PUT(req: NextRequest) {
  const { id, status, reject_reason } = await req.json();

  await supabase
    .from("hours")
    .update({ status, reject_reason: reject_reason || "" })
    .eq("id", id);

  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const { id } = await req.json();

  await supabase
    .from("hours")
    .delete()
    .eq("id", id);

  return NextResponse.json({ ok: true });
}
