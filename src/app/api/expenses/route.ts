import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const trainerId = searchParams.get("trainer_id");
  const month = searchParams.get("month");

  let query = supabase
    .from("expenses")
    .select("*, trainers(name)")
    .order("date", { ascending: false });

  if (trainerId) query = query.eq("trainer_id", trainerId);
  if (month) query = query.like("date", `${month}%`);

  const { data } = await query;

  const expenses = (data || []).map((e) => ({
    ...e,
    trainer_name: (e.trainers as { name: string })?.name || "",
    trainers: undefined,
  }));

  return NextResponse.json(expenses);
}

export async function POST(req: NextRequest) {
  const { trainer_id, date, amount, category, description } = await req.json();

  const { data } = await supabase
    .from("expenses")
    .insert({
      trainer_id,
      date,
      amount,
      category: category || "overig",
      description: description || "",
    })
    .select("id")
    .single();

  return NextResponse.json({ id: data?.id });
}

export async function PUT(req: NextRequest) {
  const { id, status, reject_reason } = await req.json();

  await supabase
    .from("expenses")
    .update({ status, reject_reason: reject_reason || "" })
    .eq("id", id);

  return NextResponse.json({ ok: true });
}
