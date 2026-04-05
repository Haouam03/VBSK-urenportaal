import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

const DAYS = ["Zondag", "Maandag", "Dinsdag", "Woensdag", "Donderdag", "Vrijdag", "Zaterdag"];

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const trainerId = searchParams.get("trainer_id");
  const month = searchParams.get("month");

  if (!trainerId || !month) {
    return NextResponse.json({ error: "trainer_id en month zijn verplicht" }, { status: 400 });
  }

  const { data: trainer } = await supabase
    .from("trainers")
    .select("name")
    .eq("id", trainerId)
    .single();

  if (!trainer) {
    return NextResponse.json({ error: "Trainer niet gevonden" }, { status: 404 });
  }

  const { data: hours } = await supabase
    .from("hours")
    .select("*, substitute:trainers!hours_substitute_for_id_fkey(name)")
    .eq("trainer_id", trainerId)
    .like("date", `${month}%`)
    .order("date")
    .order("start_time");

  const header = "Datum,Dag,Begintijd,Eindtijd,Type,Inval voor,Opmerking,Status";
  const rows = (hours || []).map((h) => {
    const d = new Date(h.date + "T00:00:00");
    const dag = DAYS[d.getDay()];
    const subName = (h.substitute as { name: string })?.name || "";
    return [
      h.date,
      dag,
      h.start_time,
      h.end_time,
      h.type,
      subName,
      `"${(h.remark || "").replace(/"/g, '""')}"`,
      h.status,
    ].join(",");
  });

  const csv = [header, ...rows].join("\n");

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="uren_${trainer.name.replace(/\s/g, "_")}_${month}.csv"`,
    },
  });
}
