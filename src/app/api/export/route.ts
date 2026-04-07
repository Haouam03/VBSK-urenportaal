import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import ExcelJS from "exceljs";

const DAYS = ["Zondag", "Maandag", "Dinsdag", "Woensdag", "Donderdag", "Vrijdag", "Zaterdag"];

// ── Exact kleuren uit sjabloon ──
const C = {
  TITLE_BG:    "FF7B1113",
  BANNER_BG:   "FFA31D1F",
  HEADER_BG:   "FF000000",
  ONKOSTEN_BG: "FFC0392B",
  ROW_PINK:    "FFFDF2F2",
  ROW_WHITE:   "FFFFFFFF",
  SUB_BG:      "FFF9E0E0",
  GRAND_BG:    "FFFBE9E9",
  WHITE:       "FFFFFFFF",
  BLACK:       "FF000000",
  GREEN:       "FF27AE60",
  RED:         "FFE74C3C",
  YELLOW:      "FFF39C12",
};

const FONT = "Aptos";

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

function statusText(status: string): string {
  if (status === "goedgekeurd") return "\u2713 goedgekeurd";
  if (status === "afgewezen") return "\u2717 afgewezen";
  if (status === "ingediend") return "\u23F3 ingediend";
  return status;
}

function statusColor(status: string): string {
  if (status === "goedgekeurd") return C.GREEN;
  if (status === "afgewezen") return C.RED;
  if (status === "ingediend") return C.YELLOW;
  return C.BLACK;
}

// Fill all 9 cells of a row with a background color
function fillRow(row: ExcelJS.Row, color: string) {
  for (let col = 1; col <= 9; col++) {
    row.getCell(col).fill = { type: "pattern", pattern: "solid", fgColor: { argb: color } };
  }
}

// Set font for all 9 cells
function fontRow(row: ExcelJS.Row, font: Partial<ExcelJS.Font>) {
  for (let col = 1; col <= 9; col++) {
    row.getCell(col).font = { name: FONT, ...font };
  }
}

// Set top border on all 9 cells
function borderTopRow(row: ExcelJS.Row, style: "thin" | "medium" = "thin") {
  for (let col = 1; col <= 9; col++) {
    row.getCell(col).border = { top: { style, color: { argb: C.BLACK } } };
  }
}

function borderBottomRow(row: ExcelJS.Row, style: "thin" | "medium" = "medium") {
  for (let col = 1; col <= 9; col++) {
    row.getCell(col).border = { ...row.getCell(col).border, bottom: { style, color: { argb: C.BLACK } } };
  }
}

function setupColumns(ws: ExcelJS.Worksheet) {
  ws.columns = [
    { width: 15.83 },  // A - Datum
    { width: 17.5 },   // B - Dag / Soort kosten
    { width: 13.33 },  // C - Begintijd / Toelichting
    { width: 27.5 },   // D - Eindtijd / Afstand
    { width: 13 },     // E - Uren / Bedrag
    { width: 13.33 },  // F - Type
    { width: 17.5 },   // G - Inval voor
    { width: 25.83 },  // H - Opmerking
    { width: 29.16 },  // I - Status
  ];
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const trainerId = searchParams.get("trainer_id");
  const month = searchParams.get("month");
  const format = searchParams.get("format") || "xlsx";

  if (!month) {
    return NextResponse.json({ error: "month is verplicht" }, { status: 400 });
  }

  // ══════════════════════════════════════════
  // ALL TRAINERS EXPORT (single sheet)
  // ══════════════════════════════════════════
  if (!trainerId) {
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
      return NextResponse.json({ error: "Geen data gevonden voor deze maand" }, { status: 404 });
    }

    // Group by trainer
    const byTrainer: Record<string, { name: string; hours: typeof allHours; expenses: typeof allExpenses }> = {};
    for (const h of (allHours || [])) {
      const t = h.trainer as { id: number; name: string };
      if (!t) continue;
      const key = String(t.id);
      if (!byTrainer[key]) byTrainer[key] = { name: t.name, hours: [], expenses: [] };
      byTrainer[key].hours!.push(h);
    }
    for (const e of (allExpenses || [])) {
      const t = e.trainer as { id: number; name: string };
      if (!t) continue;
      const key = String(t.id);
      if (!byTrainer[key]) byTrainer[key] = { name: t.name, hours: [], expenses: [] };
      byTrainer[key].expenses!.push(e);
    }

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Overzicht");
    setupColumns(ws);

    // ── Row 1: Title ──
    ws.mergeCells("A1:I1");
    const titleCell = ws.getCell("A1");
    titleCell.value = `VBSK Amsterdam \u2014 Uren & Onkosten ${month}`;
    titleCell.font = { name: FONT, size: 15, bold: true, color: { argb: C.WHITE } };
    titleCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: C.TITLE_BG } };
    titleCell.alignment = { horizontal: "center", vertical: "middle" };
    ws.getRow(1).height = 42;

    // ── Row 2: Spacer ──
    ws.addRow([]);
    ws.getRow(2).height = 8;

    // Track subtotal cell references for grand total formulas
    const urenSubCells: string[] = [];
    const onkostenSubCells: string[] = [];

    const sortedTrainers = Object.values(byTrainer).sort((a, b) => a.name.localeCompare(b.name));

    for (const { name, hours: trainerHours, expenses: trainerExpenses } of sortedTrainers) {
      const rows = buildRows(trainerHours || []);
      const expRows = (trainerExpenses || []) as Array<Record<string, unknown>>;

      // ── Trainer banner ──
      const bannerRow = ws.addRow([name, "", "", "", "", "", "", "", ""]);
      ws.mergeCells(bannerRow.number, 1, bannerRow.number, 8);
      bannerRow.height = 32;
      fillRow(bannerRow, C.BANNER_BG);
      fontRow(bannerRow, { size: 13, bold: true, color: { argb: C.WHITE } });
      bannerRow.getCell(1).alignment = { vertical: "middle" };
      // I cell: summary will be set after we know subtotal cell references
      bannerRow.getCell(9).alignment = { horizontal: "right", vertical: "middle" };
      bannerRow.getCell(9).font = { name: FONT, size: 10, bold: true, color: { argb: C.WHITE } };
      bannerRow.getCell(9).fill = { type: "pattern", pattern: "solid", fgColor: { argb: C.TITLE_BG } };
      const bannerRowNum = bannerRow.number;

      // ── Uren headers ──
      const hdrRow = ws.addRow(["Datum", "Dag", "Begintijd", "Eindtijd", "Uren", "Type", "Inval voor", "Opmerking", "Status"]);
      hdrRow.height = 26;
      fillRow(hdrRow, C.HEADER_BG);
      hdrRow.eachCell((cell) => {
        cell.font = { name: FONT, size: 10, bold: true, color: { argb: C.WHITE } };
        cell.alignment = { horizontal: "center", vertical: "middle" };
        cell.border = { bottom: { style: "thin", color: { argb: C.BLACK } } };
      });

      // ── Uren data rows ──
      const firstDataRow = ws.rowCount + 1;
      rows.forEach((r, i) => {
        const bgColor = i % 2 === 0 ? C.ROW_PINK : C.ROW_WHITE;
        const dataRow = ws.addRow([r.datum, r.dag, r.begintijd, r.eindtijd, r.uren, r.type, r.invalVoor, r.opmerking, statusText(r.status)]);
        dataRow.height = 24;
        fillRow(dataRow, bgColor);
        fontRow(dataRow, { size: 11, color: { argb: C.BLACK } });
        dataRow.getCell(1).alignment = { horizontal: "left" };
        dataRow.getCell(5).numFmt = "0.00";
        dataRow.getCell(5).alignment = { horizontal: "center" };
        dataRow.getCell(9).alignment = { horizontal: "center" };
        dataRow.getCell(9).font = { name: FONT, size: 10, bold: true, color: { argb: statusColor(r.status) } };
        if (i > 0) {
          borderTopRow(dataRow, "thin");
        }
      });
      const lastDataRow = ws.rowCount;

      // ── Subtotaal uren ──
      const subRow = ws.addRow(["", "", "", "Subtotaal uren", null, "", "", "", ""]);
      subRow.height = 24;
      fillRow(subRow, C.SUB_BG);
      fontRow(subRow, { size: 10, bold: true, color: { argb: C.BLACK } });
      borderTopRow(subRow, "thin");
      subRow.getCell(4).alignment = { horizontal: "right" };
      // Use SUM formula
      const urenSubRowNum = subRow.number;
      if (rows.length > 0) {
        subRow.getCell(5).value = { formula: `SUM(E${firstDataRow}:E${lastDataRow})` } as ExcelJS.CellFormulaValue;
      } else {
        subRow.getCell(5).value = 0;
      }
      subRow.getCell(5).numFmt = "0.00";
      subRow.getCell(5).alignment = { horizontal: "center" };
      urenSubCells.push(`E${urenSubRowNum}`);

      // ── Spacer ──
      const sp1 = ws.addRow([]);
      sp1.height = 10;

      // ── Onkosten header banner ──
      const expBanner = ws.addRow([`ONKOSTEN ${name.toUpperCase()}`, "", "", "", "", "", "", "", ""]);
      ws.mergeCells(expBanner.number, 1, expBanner.number, 9);
      expBanner.height = 26;
      fillRow(expBanner, C.ONKOSTEN_BG);
      expBanner.getCell(1).font = { name: FONT, size: 10, bold: true, color: { argb: C.WHITE } };
      expBanner.getCell(1).alignment = { horizontal: "left", vertical: "middle" };

      // ── Onkosten column headers ──
      const expHdrRow = ws.addRow(["Datum", "Soort kosten", "Toelichting", "Afstand (km)", "Bedrag", "", "", "", "Status"]);
      expHdrRow.height = 26;
      fillRow(expHdrRow, C.HEADER_BG);
      expHdrRow.eachCell((cell) => {
        cell.font = { name: FONT, size: 10, bold: true, color: { argb: C.WHITE } };
        cell.alignment = { horizontal: "center", vertical: "middle" };
        cell.border = { bottom: { style: "thin", color: { argb: C.BLACK } } };
      });

      // ── Onkosten data rows ──
      const firstExpRow = ws.rowCount + 1;
      if (expRows.length > 0) {
        expRows.forEach((e, i) => {
          const bgColor = i % 2 === 0 ? C.ROW_PINK : C.ROW_WHITE;
          const expDataRow = ws.addRow([
            formatDateNL(e.date as string),
            e.category as string,
            e.description as string,
            "",
            e.amount as number,
            "",
            "",
            "",
            statusText(e.status as string),
          ]);
          expDataRow.height = 24;
          fillRow(expDataRow, bgColor);
          fontRow(expDataRow, { size: 11, color: { argb: C.BLACK } });
          ws.mergeCells(expDataRow.number, 2, expDataRow.number, 3);
          ws.mergeCells(expDataRow.number, 6, expDataRow.number, 8);
          expDataRow.getCell(1).alignment = { horizontal: "left" };
          expDataRow.getCell(5).numFmt = "\\€#,##0.00";
          expDataRow.getCell(5).alignment = { horizontal: "center" };
          expDataRow.getCell(9).alignment = { horizontal: "center" };
          expDataRow.getCell(9).font = { name: FONT, size: 10, bold: true, color: { argb: statusColor(e.status as string) } };
        });
      }
      const lastExpRow = ws.rowCount;

      // ── Subtotaal onkosten ──
      const expSubRow = ws.addRow(["", "", "", `Subtotaal onkosten ${name}`, null, "", "", "", ""]);
      expSubRow.height = 24;
      fillRow(expSubRow, C.SUB_BG);
      fontRow(expSubRow, { size: 10, bold: true, color: { argb: C.BLACK } });
      borderTopRow(expSubRow, "thin");
      expSubRow.getCell(4).alignment = { horizontal: "right" };
      const expSubRowNum = expSubRow.number;
      if (expRows.length > 0) {
        expSubRow.getCell(5).value = { formula: `SUM(E${firstExpRow}:E${lastExpRow})` } as ExcelJS.CellFormulaValue;
      } else {
        expSubRow.getCell(5).value = 0;
      }
      expSubRow.getCell(5).numFmt = "\\€#,##0.00";
      expSubRow.getCell(5).alignment = { horizontal: "center" };
      onkostenSubCells.push(`E${expSubRowNum}`);

      // ── Update banner summary with formula referencing subtotals ──
      ws.getCell(`I${bannerRowNum}`).value = {
        formula: `TEXT(E${urenSubRowNum},"0,00")&" uur  |  \u20AC "&TEXT(E${expSubRowNum},"#.##0,00")&" onkosten"`,
      } as ExcelJS.CellFormulaValue;

      // ── Spacer between trainers ──
      const sp2 = ws.addRow([]);
      sp2.height = 10;
    }

    // ══ Grand total banner ══
    const gtBanner = ws.addRow(["TOTAAL ALLE TRAINERS", "", "", "", "", "", "", "", ""]);
    ws.mergeCells(gtBanner.number, 1, gtBanner.number, 9);
    gtBanner.height = 32;
    fillRow(gtBanner, C.BANNER_BG);
    gtBanner.getCell(1).font = { name: FONT, size: 13, bold: true, color: { argb: C.WHITE } };
    gtBanner.getCell(1).alignment = { vertical: "middle" };

    // ── Totaal uren row ──
    const gtUrenRow = ws.addRow(["", "", "", "Totaal uren", null, "", "", "", ""]);
    gtUrenRow.height = 28;
    fillRow(gtUrenRow, C.GRAND_BG);
    fontRow(gtUrenRow, { size: 11, color: { argb: C.BLACK } });
    gtUrenRow.getCell(4).font = { name: FONT, size: 12, bold: true, color: { argb: C.BLACK } };
    gtUrenRow.getCell(4).alignment = { horizontal: "right" };
    gtUrenRow.getCell(5).value = { formula: urenSubCells.join("+") } as ExcelJS.CellFormulaValue;
    gtUrenRow.getCell(5).font = { name: FONT, size: 12, bold: true, color: { argb: C.BLACK } };
    gtUrenRow.getCell(5).numFmt = "0.00";
    gtUrenRow.getCell(5).alignment = { horizontal: "center" };

    // ── Totaal onkosten row ──
    const gtExpRow = ws.addRow(["", "", "", "Totaal onkosten", null, "", "", "", ""]);
    gtExpRow.height = 28;
    fillRow(gtExpRow, C.GRAND_BG);
    fontRow(gtExpRow, { size: 11, color: { argb: C.BLACK } });
    borderBottomRow(gtExpRow, "medium");
    gtExpRow.getCell(4).font = { name: FONT, size: 12, bold: true, color: { argb: C.BLACK } };
    gtExpRow.getCell(4).alignment = { horizontal: "right" };
    gtExpRow.getCell(5).value = { formula: onkostenSubCells.join("+") } as ExcelJS.CellFormulaValue;
    gtExpRow.getCell(5).font = { name: FONT, size: 12, bold: true, color: { argb: C.BLACK } };
    gtExpRow.getCell(5).numFmt = "\\€#,##0.00";
    gtExpRow.getCell(5).alignment = { horizontal: "center" };

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

  // ══════════════════════════════════════════
  // SINGLE TRAINER EXPORT
  // ══════════════════════════════════════════
  const { data: trainer } = await supabase
    .from("trainers")
    .select("name")
    .eq("id", trainerId)
    .single();

  if (!trainer) {
    return NextResponse.json({ error: "Trainer niet gevonden" }, { status: 404 });
  }

  const [{ data: hours }, { data: expenses }] = await Promise.all([
    supabase
      .from("hours")
      .select("*, substitute:trainers!hours_substitute_for_id_fkey(name)")
      .eq("trainer_id", trainerId)
      .like("date", `${month}%`)
      .order("date")
      .order("start_time"),
    supabase
      .from("expenses")
      .select("*")
      .eq("trainer_id", trainerId)
      .like("date", `${month}%`)
      .order("date"),
  ]);

  const rows = buildRows(hours || []);
  const expRows = (expenses || []) as Array<Record<string, unknown>>;

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

  // Excel export — same styling as all-trainers but for single trainer
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Overzicht");
  setupColumns(ws);

  // Title
  ws.mergeCells("A1:I1");
  const titleCell = ws.getCell("A1");
  titleCell.value = `VBSK Amsterdam \u2014 Uren & Onkosten ${month}`;
  titleCell.font = { name: FONT, size: 15, bold: true, color: { argb: C.WHITE } };
  titleCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: C.TITLE_BG } };
  titleCell.alignment = { horizontal: "center", vertical: "middle" };
  ws.getRow(1).height = 42;

  ws.addRow([]);
  ws.getRow(2).height = 8;

  // Trainer banner
  const bannerRow = ws.addRow([trainer.name, "", "", "", "", "", "", "", ""]);
  ws.mergeCells(bannerRow.number, 1, bannerRow.number, 8);
  bannerRow.height = 32;
  fillRow(bannerRow, C.BANNER_BG);
  fontRow(bannerRow, { size: 13, bold: true, color: { argb: C.WHITE } });
  bannerRow.getCell(1).alignment = { vertical: "middle" };
  bannerRow.getCell(9).alignment = { horizontal: "right", vertical: "middle" };
  bannerRow.getCell(9).font = { name: FONT, size: 10, bold: true, color: { argb: C.WHITE } };
  bannerRow.getCell(9).fill = { type: "pattern", pattern: "solid", fgColor: { argb: C.TITLE_BG } };

  // Uren headers
  const hdrRow = ws.addRow(["Datum", "Dag", "Begintijd", "Eindtijd", "Uren", "Type", "Inval voor", "Opmerking", "Status"]);
  hdrRow.height = 26;
  fillRow(hdrRow, C.HEADER_BG);
  hdrRow.eachCell((cell) => {
    cell.font = { name: FONT, size: 10, bold: true, color: { argb: C.WHITE } };
    cell.alignment = { horizontal: "center", vertical: "middle" };
    cell.border = { bottom: { style: "thin", color: { argb: C.BLACK } } };
  });

  // Uren data
  const firstDataRow = ws.rowCount + 1;
  rows.forEach((r, i) => {
    const bgColor = i % 2 === 0 ? C.ROW_PINK : C.ROW_WHITE;
    const dataRow = ws.addRow([r.datum, r.dag, r.begintijd, r.eindtijd, r.uren, r.type, r.invalVoor, r.opmerking, statusText(r.status)]);
    dataRow.height = 24;
    fillRow(dataRow, bgColor);
    fontRow(dataRow, { size: 11, color: { argb: C.BLACK } });
    dataRow.getCell(1).alignment = { horizontal: "left" };
    dataRow.getCell(5).numFmt = "0.00";
    dataRow.getCell(5).alignment = { horizontal: "center" };
    dataRow.getCell(9).alignment = { horizontal: "center" };
    dataRow.getCell(9).font = { name: FONT, size: 10, bold: true, color: { argb: statusColor(r.status) } };
    if (i > 0) borderTopRow(dataRow, "thin");
  });
  const lastDataRow = ws.rowCount;

  // Subtotaal uren
  const subRow = ws.addRow(["", "", "", "Subtotaal uren", null, "", "", "", ""]);
  subRow.height = 24;
  fillRow(subRow, C.SUB_BG);
  fontRow(subRow, { size: 10, bold: true, color: { argb: C.BLACK } });
  borderTopRow(subRow, "thin");
  subRow.getCell(4).alignment = { horizontal: "right" };
  const urenSubRowNum = subRow.number;
  if (rows.length > 0) {
    subRow.getCell(5).value = { formula: `SUM(E${firstDataRow}:E${lastDataRow})` } as ExcelJS.CellFormulaValue;
  } else {
    subRow.getCell(5).value = 0;
  }
  subRow.getCell(5).numFmt = "0.00";
  subRow.getCell(5).alignment = { horizontal: "center" };

  // Spacer
  const sp1 = ws.addRow([]);
  sp1.height = 10;

  // Onkosten banner
  const expBanner = ws.addRow([`ONKOSTEN ${trainer.name.toUpperCase()}`, "", "", "", "", "", "", "", ""]);
  ws.mergeCells(expBanner.number, 1, expBanner.number, 9);
  expBanner.height = 26;
  fillRow(expBanner, C.ONKOSTEN_BG);
  expBanner.getCell(1).font = { name: FONT, size: 10, bold: true, color: { argb: C.WHITE } };
  expBanner.getCell(1).alignment = { horizontal: "left", vertical: "middle" };

  // Onkosten headers
  const expHdrRow = ws.addRow(["Datum", "Soort kosten", "Toelichting", "Afstand (km)", "Bedrag", "", "", "", "Status"]);
  expHdrRow.height = 26;
  fillRow(expHdrRow, C.HEADER_BG);
  expHdrRow.eachCell((cell) => {
    cell.font = { name: FONT, size: 10, bold: true, color: { argb: C.WHITE } };
    cell.alignment = { horizontal: "center", vertical: "middle" };
    cell.border = { bottom: { style: "thin", color: { argb: C.BLACK } } };
  });

  // Onkosten data
  const firstExpRow = ws.rowCount + 1;
  if (expRows.length > 0) {
    expRows.forEach((e, i) => {
      const bgColor = i % 2 === 0 ? C.ROW_PINK : C.ROW_WHITE;
      const expDataRow = ws.addRow([
        formatDateNL(e.date as string),
        e.category as string,
        e.description as string,
        "",
        e.amount as number,
        "", "", "",
        statusText(e.status as string),
      ]);
      expDataRow.height = 24;
      fillRow(expDataRow, bgColor);
      fontRow(expDataRow, { size: 11, color: { argb: C.BLACK } });
      ws.mergeCells(expDataRow.number, 2, expDataRow.number, 3);
      ws.mergeCells(expDataRow.number, 6, expDataRow.number, 8);
      expDataRow.getCell(1).alignment = { horizontal: "left" };
      expDataRow.getCell(5).numFmt = "\\€#,##0.00";
      expDataRow.getCell(5).alignment = { horizontal: "center" };
      expDataRow.getCell(9).alignment = { horizontal: "center" };
      expDataRow.getCell(9).font = { name: FONT, size: 10, bold: true, color: { argb: statusColor(e.status as string) } };
    });
  }
  const lastExpRow = ws.rowCount;

  // Subtotaal onkosten
  const expSubRow = ws.addRow(["", "", "", `Subtotaal onkosten ${trainer.name}`, null, "", "", "", ""]);
  expSubRow.height = 24;
  fillRow(expSubRow, C.SUB_BG);
  fontRow(expSubRow, { size: 10, bold: true, color: { argb: C.BLACK } });
  borderTopRow(expSubRow, "thin");
  expSubRow.getCell(4).alignment = { horizontal: "right" };
  const expSubRowNum = expSubRow.number;
  if (expRows.length > 0) {
    expSubRow.getCell(5).value = { formula: `SUM(E${firstExpRow}:E${lastExpRow})` } as ExcelJS.CellFormulaValue;
  } else {
    expSubRow.getCell(5).value = 0;
  }
  expSubRow.getCell(5).numFmt = "\\€#,##0.00";
  expSubRow.getCell(5).alignment = { horizontal: "center" };

  // Update banner summary
  ws.getCell(`I${bannerRow.number}`).value = {
    formula: `TEXT(E${urenSubRowNum},"0,00")&" uur  |  \u20AC "&TEXT(E${expSubRowNum},"#.##0,00")&" onkosten"`,
  } as ExcelJS.CellFormulaValue;

  ws.pageSetup = { orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0 };

  const buffer = await wb.xlsx.writeBuffer();
  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="uren_${trainer.name.replace(/\s/g, "_")}_${month}.xlsx"`,
    },
  });
}
