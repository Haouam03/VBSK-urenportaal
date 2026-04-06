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

function buildRows(hours: Array<Record<string, unknown>>) {
  return (hours || []).map((h) => {
    const d = new Date((h.date as string) + "T00:00:00");
    const dag = DAYS[d.getDay()];
    const subName = (h.substitute as { name: string })?.name || "";
    const totalHours = calcHours(h.start_time as string, h.end_time as string);
    return {
      datum: formatDateNL(h.date as string),
      dag,
      begintijd: h.start_time as string,
      eindtijd: h.end_time as string,
      uren: totalHours,
      type: h.type as string,
      invalVoor: subName,
      opmerking: (h.remark as string) || "",
      status: h.status as string,
    };
  });
}

function addTrainerSheet(
  wb: ExcelJS.Workbook,
  trainerName: string,
  month: string,
  rows: ReturnType<typeof buildRows>
) {
  const sheetName = trainerName.substring(0, 31); // Excel sheet name max 31 chars
  const ws = wb.addWorksheet(sheetName);

  // Title row
  ws.mergeCells("A1:I1");
  const titleCell = ws.getCell("A1");
  titleCell.value = `${trainerName} — ${month}`;
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
    { width: 14 }, { width: 12 }, { width: 10 }, { width: 10 },
    { width: 8 }, { width: 10 }, { width: 16 }, { width: 24 }, { width: 14 },
  ];

  return rows.reduce((s, r) => s + r.uren, 0);
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const trainerId = searchParams.get("trainer_id");
  const month = searchParams.get("month");
  const format = searchParams.get("format") || "xlsx";

  if (!month) {
    return NextResponse.json({ error: "month is verplicht" }, { status: 400 });
  }

  // ── All trainers export (single sheet) ──
  if (!trainerId) {
    const { data: allHours } = await supabase
      .from("hours")
      .select("*, trainer:trainers!hours_trainer_id_fkey(id, name), substitute:trainers!hours_substitute_for_id_fkey(name)")
      .like("date", `${month}%`)
      .order("date")
      .order("start_time");

    if (!allHours || allHours.length === 0) {
      return NextResponse.json({ error: "Geen uren gevonden voor deze maand" }, { status: 404 });
    }

    // Group by trainer
    const byTrainer: Record<string, { name: string; hours: typeof allHours }> = {};
    for (const h of allHours) {
      const t = h.trainer as { id: number; name: string };
      if (!t) continue;
      const key = String(t.id);
      if (!byTrainer[key]) byTrainer[key] = { name: t.name, hours: [] };
      byTrainer[key].hours.push(h);
    }

    const DARK_RED = "FF8B0000";
    const LIGHT_GRAY = "FFF3F4F6";
    const WHITE = "FFFFFFFF";
    const DARK_GRAY = "FF4B5563";
    const HEADER_COLS = ["Datum", "Dag", "Begintijd", "Eindtijd", "Uren", "Type", "Inval voor", "Opmerking", "Status"];

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Urenoverzicht");

    // Column widths
    ws.columns = [
      { width: 14 }, { width: 12 }, { width: 11 }, { width: 11 },
      { width: 9 }, { width: 12 }, { width: 16 }, { width: 28 }, { width: 14 },
    ];

    // Document title
    ws.mergeCells("A1:I1");
    const titleCell = ws.getCell("A1");
    titleCell.value = `VBSK Amsterdam — Urenoverzicht ${month}`;
    titleCell.font = { size: 16, bold: true, color: { argb: DARK_RED } };
    titleCell.alignment = { horizontal: "center", vertical: "middle" };
    ws.getRow(1).height = 30;

    // Empty spacer row
    ws.addRow([]);

    let grandTotal = 0;
    let grandCount = 0;
    const sortedTrainers = Object.values(byTrainer).sort((a, b) => a.name.localeCompare(b.name));

    for (const { name, hours: trainerHours } of sortedTrainers) {
      const rows = buildRows(trainerHours);
      const trainerTotal = rows.reduce((s, r) => s + r.uren, 0);
      grandTotal += trainerTotal;
      grandCount += rows.length;

      // ── Trainer name banner (dark red, full width) ──
      const bannerRow = ws.addRow([`${name}`, "", "", "", "", "", "", "", `${rows.length} invoer${rows.length !== 1 ? "en" : ""} — ${trainerTotal.toFixed(2)} uur`]);
      ws.mergeCells(bannerRow.number, 1, bannerRow.number, 8);
      bannerRow.height = 26;
      bannerRow.eachCell((cell) => {
        cell.font = { bold: true, size: 12, color: { argb: WHITE } };
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: DARK_RED } };
        cell.alignment = { vertical: "middle" };
      });
      bannerRow.getCell(9).alignment = { horizontal: "right", vertical: "middle" };
      bannerRow.getCell(9).font = { bold: false, size: 10, color: { argb: WHITE } };

      // ── Column headers ──
      const headerRow = ws.addRow(HEADER_COLS);
      headerRow.eachCell((cell) => {
        cell.font = { bold: true, size: 10, color: { argb: WHITE } };
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: DARK_GRAY } };
        cell.alignment = { horizontal: "center", vertical: "middle" };
        cell.border = {
          bottom: { style: "thin", color: { argb: "FF000000" } },
        };
      });

      // ── Data rows ──
      rows.forEach((r, i) => {
        const dataRow = ws.addRow([r.datum, r.dag, r.begintijd, r.eindtijd, r.uren, r.type, r.invalVoor, r.opmerking, r.status]);
        dataRow.getCell(5).numFmt = "0.00";
        dataRow.getCell(5).alignment = { horizontal: "center" };
        dataRow.getCell(1).alignment = { horizontal: "left" };
        dataRow.getCell(9).alignment = { horizontal: "center" };

        // Status coloring
        const statusCell = dataRow.getCell(9);
        if (r.status === "goedgekeurd") {
          statusCell.font = { color: { argb: "FF16A34A" }, bold: true, size: 10 };
        } else if (r.status === "afgewezen") {
          statusCell.font = { color: { argb: "FFDC2626" }, bold: true, size: 10 };
        } else if (r.status === "ingediend") {
          statusCell.font = { color: { argb: "FFCA8A04" }, bold: true, size: 10 };
        }

        // Alternating row background
        if (i % 2 === 0) {
          dataRow.eachCell((cell) => {
            cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: LIGHT_GRAY } };
          });
        }

        // Light borders for readability
        dataRow.eachCell((cell) => {
          cell.border = {
            ...cell.border,
            bottom: { style: "hair", color: { argb: "FFD1D5DB" } },
          };
        });
      });

      // ── Subtotal row ──
      const subRow = ws.addRow(["", "", "", "Subtotaal", trainerTotal, "", "", "", ""]);
      subRow.getCell(4).font = { bold: true, size: 10 };
      subRow.getCell(5).font = { bold: true, size: 10 };
      subRow.getCell(5).numFmt = "0.00";
      subRow.getCell(5).alignment = { horizontal: "center" };
      subRow.eachCell((cell) => {
        cell.border = { top: { style: "thin", color: { argb: "FF000000" } } };
      });

      // Spacer row between trainers
      ws.addRow([]);
    }

    // ══ Grand total row ══
    const gtBanner = ws.addRow(["TOTAAL ALLE TRAINERS", "", "", "", grandTotal, "", "", "", `${grandCount} invoeren`]);
    ws.mergeCells(gtBanner.number, 1, gtBanner.number, 4);
    gtBanner.height = 28;
    gtBanner.eachCell((cell) => {
      cell.font = { bold: true, size: 12, color: { argb: WHITE } };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: DARK_RED } };
      cell.alignment = { vertical: "middle" };
    });
    gtBanner.getCell(5).numFmt = "0.00";
    gtBanner.getCell(5).alignment = { horizontal: "center", vertical: "middle" };
    gtBanner.getCell(9).alignment = { horizontal: "right", vertical: "middle" };
    gtBanner.getCell(9).font = { bold: false, size: 10, color: { argb: WHITE } };

    // Print settings
    ws.pageSetup = { orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0 };

    const buffer = await wb.xlsx.writeBuffer();
    return new NextResponse(buffer, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="uren_alle_trainers_${month}.xlsx"`,
      },
    });
  }

  // ── Single trainer export ──
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

  const rows = buildRows(hours || []);

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
  addTrainerSheet(wb, trainer.name, month, rows);

  const buffer = await wb.xlsx.writeBuffer();

  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="uren_${trainer.name.replace(/\s/g, "_")}_${month}.xlsx"`,
    },
  });
}
