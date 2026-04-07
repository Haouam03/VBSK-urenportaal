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
    // Fetch hours and expenses in parallel
    const [{ data: allHours }, { data: allExpenses }] = await Promise.all([
      supabase
        .from("hours")
        .select("*, trainer:trainers!hours_trainer_id_fkey(id, name), substitute:trainers!hours_substitute_for_id_fkey(name)")
        .like("date", `${month}%`)
        .order("date")
        .order("start_time"),
      supabase
        .from("expenses")
        .select("*, trainer:trainers!expenses_trainer_id_fkey(id, name)")
        .like("date", `${month}%`)
        .order("date"),
    ]);

    if ((!allHours || allHours.length === 0) && (!allExpenses || allExpenses.length === 0)) {
      return NextResponse.json({ error: "Geen uren of onkosten gevonden voor deze maand" }, { status: 404 });
    }

    // Group hours by trainer
    const byTrainer: Record<string, { name: string; hours: typeof allHours; expenses: typeof allExpenses }> = {};
    for (const h of (allHours || [])) {
      const t = h.trainer as { id: number; name: string };
      if (!t) continue;
      const key = String(t.id);
      if (!byTrainer[key]) byTrainer[key] = { name: t.name, hours: [], expenses: [] };
      byTrainer[key].hours!.push(h);
    }
    // Group expenses by trainer
    for (const e of (allExpenses || [])) {
      const t = e.trainer as { id: number; name: string };
      if (!t) continue;
      const key = String(t.id);
      if (!byTrainer[key]) byTrainer[key] = { name: t.name, hours: [], expenses: [] };
      byTrainer[key].expenses!.push(e);
    }

    const DARK_RED = "FF8B0000";
    const LIGHT_GRAY = "FFF3F4F6";
    const WHITE = "FFFFFFFF";
    const DARK_GRAY = "FF4B5563";
    const EXPENSE_BLUE = "FF1E3A5F";
    const HEADER_COLS = ["Datum", "Dag", "Begintijd", "Eindtijd", "Uren", "Type", "Inval voor", "Opmerking", "Status"];
    const EXPENSE_HEADER_COLS = ["Datum", "Categorie", "Omschrijving", "", "Bedrag", "", "", "", "Status"];

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Overzicht");

    // Column widths
    ws.columns = [
      { width: 14 }, { width: 14 }, { width: 11 }, { width: 11 },
      { width: 11 }, { width: 12 }, { width: 16 }, { width: 28 }, { width: 14 },
    ];

    // Document title
    ws.mergeCells("A1:I1");
    const titleCell = ws.getCell("A1");
    titleCell.value = `VBSK Amsterdam — Uren & Onkosten ${month}`;
    titleCell.font = { size: 16, bold: true, color: { argb: DARK_RED } };
    titleCell.alignment = { horizontal: "center", vertical: "middle" };
    ws.getRow(1).height = 30;

    ws.addRow([]);

    let grandTotalHours = 0;
    let grandTotalExpenses = 0;
    let grandCountHours = 0;
    let grandCountExpenses = 0;
    const sortedTrainers = Object.values(byTrainer).sort((a, b) => a.name.localeCompare(b.name));

    for (const { name, hours: trainerHours, expenses: trainerExpenses } of sortedTrainers) {
      const rows = buildRows(trainerHours || []);
      const trainerTotalHours = rows.reduce((s, r) => s + r.uren, 0);
      const trainerTotalExpenses = (trainerExpenses || []).reduce((s, e) => s + ((e as Record<string, unknown>).amount as number), 0);
      grandTotalHours += trainerTotalHours;
      grandTotalExpenses += trainerTotalExpenses;
      grandCountHours += rows.length;
      grandCountExpenses += (trainerExpenses || []).length;

      // ── Trainer name banner (dark red, full width) ──
      const summaryParts: string[] = [];
      if (rows.length > 0) summaryParts.push(`${trainerTotalHours.toFixed(2)} uur`);
      if ((trainerExpenses || []).length > 0) summaryParts.push(`\u20AC${trainerTotalExpenses.toFixed(2)} onkosten`);
      const bannerRow = ws.addRow([name, "", "", "", "", "", "", "", summaryParts.join("  |  ")]);
      ws.mergeCells(bannerRow.number, 1, bannerRow.number, 8);
      bannerRow.height = 28;
      bannerRow.eachCell((cell) => {
        cell.font = { bold: true, size: 13, color: { argb: WHITE } };
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: DARK_RED } };
        cell.alignment = { vertical: "middle" };
      });
      bannerRow.getCell(9).alignment = { horizontal: "right", vertical: "middle" };
      bannerRow.getCell(9).font = { bold: false, size: 10, color: { argb: WHITE } };

      // ── UREN SECTIE ──
      if (rows.length > 0) {
        // Column headers
        const headerRow = ws.addRow(HEADER_COLS);
        headerRow.eachCell((cell) => {
          cell.font = { bold: true, size: 10, color: { argb: WHITE } };
          cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: DARK_GRAY } };
          cell.alignment = { horizontal: "center", vertical: "middle" };
          cell.border = { bottom: { style: "thin", color: { argb: "FF000000" } } };
        });

        // Data rows
        rows.forEach((r, i) => {
          const dataRow = ws.addRow([r.datum, r.dag, r.begintijd, r.eindtijd, r.uren, r.type, r.invalVoor, r.opmerking, r.status]);
          dataRow.getCell(5).numFmt = "0.00";
          dataRow.getCell(5).alignment = { horizontal: "center" };
          dataRow.getCell(1).alignment = { horizontal: "left" };
          dataRow.getCell(9).alignment = { horizontal: "center" };

          const statusCell = dataRow.getCell(9);
          if (r.status === "goedgekeurd") {
            statusCell.font = { color: { argb: "FF16A34A" }, bold: true, size: 10 };
          } else if (r.status === "afgewezen") {
            statusCell.font = { color: { argb: "FFDC2626" }, bold: true, size: 10 };
          } else if (r.status === "ingediend") {
            statusCell.font = { color: { argb: "FFCA8A04" }, bold: true, size: 10 };
          }

          if (i % 2 === 0) {
            dataRow.eachCell((cell) => {
              cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: LIGHT_GRAY } };
            });
          }
          dataRow.eachCell((cell) => {
            cell.border = { ...cell.border, bottom: { style: "hair", color: { argb: "FFD1D5DB" } } };
          });
        });

        // Subtotal uren
        const subRow = ws.addRow(["", "", "", "Subtotaal uren", trainerTotalHours, "", "", "", ""]);
        subRow.getCell(4).font = { bold: true, size: 10 };
        subRow.getCell(5).font = { bold: true, size: 10 };
        subRow.getCell(5).numFmt = "0.00";
        subRow.getCell(5).alignment = { horizontal: "center" };
        subRow.eachCell((cell) => {
          cell.border = { top: { style: "thin", color: { argb: "FF000000" } } };
        });
      }

      // ── ONKOSTEN SECTIE ──
      if ((trainerExpenses || []).length > 0) {
        // Small spacer if there were also hours
        if (rows.length > 0) {
          const spacer = ws.addRow([]);
          spacer.height = 6;
        }

        // Onkosten sub-header
        const expLabel = ws.addRow(["ONKOSTEN", "", "", "", "", "", "", "", ""]);
        ws.mergeCells(expLabel.number, 1, expLabel.number, 9);
        expLabel.getCell(1).font = { bold: true, size: 10, color: { argb: WHITE } };
        expLabel.getCell(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: EXPENSE_BLUE } };
        expLabel.getCell(1).alignment = { vertical: "middle" };
        expLabel.height = 22;

        // Expense column headers
        const expHeaderRow = ws.addRow(EXPENSE_HEADER_COLS);
        expHeaderRow.eachCell((cell, colNumber) => {
          cell.font = { bold: true, size: 10, color: { argb: WHITE } };
          cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: DARK_GRAY } };
          cell.alignment = { horizontal: "center", vertical: "middle" };
          cell.border = { bottom: { style: "thin", color: { argb: "FF000000" } } };
          // Hide empty header cells visually
          if (colNumber === 4 || colNumber === 6 || colNumber === 7 || colNumber === 8) {
            cell.value = "";
          }
        });

        // Expense data rows
        (trainerExpenses || []).forEach((exp, i) => {
          const e = exp as Record<string, unknown>;
          const expRow = ws.addRow([
            formatDateNL(e.date as string),
            e.category as string,
            e.description as string,
            "",
            e.amount as number,
            "",
            "",
            "",
            e.status as string,
          ]);
          ws.mergeCells(expRow.number, 2, expRow.number, 3);
          ws.mergeCells(expRow.number, 6, expRow.number, 8);
          expRow.getCell(5).numFmt = "\u20AC#,##0.00";
          expRow.getCell(5).alignment = { horizontal: "center" };
          expRow.getCell(9).alignment = { horizontal: "center" };

          const statusCell = expRow.getCell(9);
          if ((e.status as string) === "goedgekeurd") {
            statusCell.font = { color: { argb: "FF16A34A" }, bold: true, size: 10 };
          } else if ((e.status as string) === "afgewezen") {
            statusCell.font = { color: { argb: "FFDC2626" }, bold: true, size: 10 };
          } else if ((e.status as string) === "ingediend") {
            statusCell.font = { color: { argb: "FFCA8A04" }, bold: true, size: 10 };
          }

          if (i % 2 === 0) {
            expRow.eachCell((cell) => {
              cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: LIGHT_GRAY } };
            });
          }
          expRow.eachCell((cell) => {
            cell.border = { ...cell.border, bottom: { style: "hair", color: { argb: "FFD1D5DB" } } };
          });
        });

        // Subtotal onkosten
        const expSubRow = ws.addRow(["", "", "", "Subtotaal onkosten", trainerTotalExpenses, "", "", "", ""]);
        expSubRow.getCell(4).font = { bold: true, size: 10 };
        expSubRow.getCell(5).font = { bold: true, size: 10 };
        expSubRow.getCell(5).numFmt = "\u20AC#,##0.00";
        expSubRow.getCell(5).alignment = { horizontal: "center" };
        expSubRow.eachCell((cell) => {
          cell.border = { top: { style: "thin", color: { argb: "FF000000" } } };
        });
      }

      // Spacer row between trainers
      ws.addRow([]);
    }

    // ══ Grand total banner ══
    const gtBanner = ws.addRow(["TOTAAL ALLE TRAINERS", "", "", "", "", "", "", "", ""]);
    ws.mergeCells(gtBanner.number, 1, gtBanner.number, 9);
    gtBanner.height = 28;
    gtBanner.getCell(1).font = { bold: true, size: 13, color: { argb: WHITE } };
    gtBanner.getCell(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: DARK_RED } };
    gtBanner.getCell(1).alignment = { vertical: "middle" };
    // Fill all cells with dark red
    gtBanner.eachCell((cell) => {
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: DARK_RED } };
    });

    // Grand total uren row
    if (grandCountHours > 0) {
      const gtHoursRow = ws.addRow(["", "", "", `Totaal uren (${grandCountHours} invoeren)`, grandTotalHours, "", "", "", ""]);
      gtHoursRow.getCell(4).font = { bold: true, size: 11 };
      gtHoursRow.getCell(5).font = { bold: true, size: 11 };
      gtHoursRow.getCell(5).numFmt = "0.00";
      gtHoursRow.getCell(5).alignment = { horizontal: "center" };
      gtHoursRow.eachCell((cell) => {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFEF2F2" } };
      });
    }

    // Grand total onkosten row
    if (grandCountExpenses > 0) {
      const gtExpRow = ws.addRow(["", "", "", `Totaal onkosten (${grandCountExpenses} invoeren)`, grandTotalExpenses, "", "", "", ""]);
      gtExpRow.getCell(4).font = { bold: true, size: 11 };
      gtExpRow.getCell(5).font = { bold: true, size: 11 };
      gtExpRow.getCell(5).numFmt = "\u20AC#,##0.00";
      gtExpRow.getCell(5).alignment = { horizontal: "center" };
      gtExpRow.eachCell((cell) => {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFEF2F2" } };
        cell.border = { bottom: { style: "thin", color: { argb: DARK_RED } } };
      });
    }

    // Print settings
    ws.pageSetup = { orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0 };

    const buffer = await wb.xlsx.writeBuffer();
    return new NextResponse(buffer, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="uren_onkosten_alle_trainers_${month}.xlsx"`,
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
