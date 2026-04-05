import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import ExcelJS from "exceljs";

const DAYS = ["Zondag", "Maandag", "Dinsdag", "Woensdag", "Donderdag", "Vrijdag", "Zaterdag"];

function formatDateNL(dateStr: string) {
  const [y, m, d] = dateStr.split("-");
  return `${d}-${m}-${y}`;
}

function calcHours(start: string, end: string): number {
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  return Math.round(((eh * 60 + em) - (sh * 60 + sm)) / 60 * 100) / 100;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const trainerId = searchParams.get("trainer_id");
  const month = searchParams.get("month");
  const format = searchParams.get("format") || "xlsx";

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

  const rows = (hours || []).map((h) => {
    const d = new Date(h.date + "T00:00:00");
    const dag = DAYS[d.getDay()];
    const subName = (h.substitute as { name: string })?.name || "";
    const totalHours = calcHours(h.start_time, h.end_time);
    return {
      datum: formatDateNL(h.date),
      dag,
      begintijd: h.start_time,
      eindtijd: h.end_time,
      uren: totalHours,
      type: h.type,
      invalVoor: subName,
      opmerking: h.remark || "",
      status: h.status,
    };
  });

  if (format === "csv") {
    const header = "Datum,Dag,Begintijd,Eindtijd,Uren,Type,Inval voor,Opmerking,Status";
    const csvRows = rows.map((r) =>
      [r.datum, r.dag, r.begintijd, r.eindtijd, r.uren, r.type, r.invalVoor, `"${r.opmerking.replace(/"/g, '""')}"`, r.status].join(",")
    );
    const csv = [header, ...csvRows].join("\n");

    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="uren_${trainer.name.replace(/\s/g, "_")}_${month}.csv"`,
      },
    });
  }

  // Excel export
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(`uren_${trainer.name}_${month}`);

  // Title row
  ws.mergeCells("A1:I1");
  const titleCell = ws.getCell("A1");
  titleCell.value = `uren_${trainer.name}_${month}`;
  titleCell.font = { size: 14, bold: true };
  titleCell.alignment = { horizontal: "center" };

  // Header row
  const headerRow = ws.addRow(["Datum", "Dag", "Begintijd", "Eindtijd", "Uren", "Type", "Inval voor", "Opmerking", "Status"]);
  headerRow.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF4B5563" } };
    cell.alignment = { horizontal: "center" };
    cell.border = {
      bottom: { style: "thin", color: { argb: "FF000000" } },
    };
  });

  // Data rows
  for (const r of rows) {
    const row = ws.addRow([r.datum, r.dag, r.begintijd, r.eindtijd, r.uren, r.type, r.invalVoor, r.opmerking, r.status]);
    row.getCell(5).numFmt = "0.00";
    row.getCell(5).alignment = { horizontal: "center" };
    // Alternate row coloring
    if (rows.indexOf(r) % 2 === 0) {
      row.eachCell((cell) => {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF9FAFB" } };
      });
    }
  }

  // Totaal row
  const totalRow = ws.addRow(["", "", "", "Totaal", rows.reduce((s, r) => s + r.uren, 0), "", "", "", ""]);
  totalRow.getCell(4).font = { bold: true };
  totalRow.getCell(5).font = { bold: true };
  totalRow.getCell(5).numFmt = "0.00";
  totalRow.getCell(5).alignment = { horizontal: "center" };

  // Column widths
  ws.columns = [
    { width: 14 }, // Datum
    { width: 12 }, // Dag
    { width: 10 }, // Begintijd
    { width: 10 }, // Eindtijd
    { width: 8 },  // Uren
    { width: 10 }, // Type
    { width: 16 }, // Inval voor
    { width: 24 }, // Opmerking
    { width: 14 }, // Status
  ];

  const buffer = await wb.xlsx.writeBuffer();

  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="uren_${trainer.name.replace(/\s/g, "_")}_${month}.xlsx"`,
    },
  });
}
