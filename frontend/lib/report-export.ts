"use client";

import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";

type ReportColumn = {
  header: string;
  key: string;
};

type ReportSummaryItem = {
  label: string;
  value: string;
};

type ExportOptions = {
  fileBaseName: string;
  title: string;
  subtitle?: string;
  filters?: string[];
  summary?: ReportSummaryItem[];
  columns: ReportColumn[];
  rows: Array<Record<string, string | number>>;
};

function timestamp() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  return `${yyyy}${mm}${dd}_${hh}${mi}`;
}

export function exportReportExcel(options: ExportOptions) {
  const wb = XLSX.utils.book_new();
  const headerLines: (string | number)[][] = [[options.title]];
  if (options.subtitle) headerLines.push([options.subtitle]);
  if (options.filters?.length) headerLines.push([`Filtros: ${options.filters.join(" | ")}`]);
  if (options.summary?.length) {
    options.summary.forEach((s) => headerLines.push([`${s.label}: ${s.value}`]));
  }
  headerLines.push([]);

  const headers = options.columns.map((c) => c.header);
  const body = options.rows.map((row) => options.columns.map((c) => row[c.key] ?? ""));
  const sheetData = [...headerLines, headers, ...body];
  const ws = XLSX.utils.aoa_to_sheet(sheetData);

  ws["!cols"] = options.columns.map((c) => ({
    wch: Math.max(c.header.length + 2, 16),
  }));

  XLSX.utils.book_append_sheet(wb, ws, "Relatorio");
  XLSX.writeFile(wb, `${options.fileBaseName}_${timestamp()}.xlsx`);
}

export function exportReportPdf(options: ExportOptions) {
  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
  const margin = 36;
  let y = margin;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text(options.title, margin, y);
  y += 18;

  if (options.subtitle) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text(options.subtitle, margin, y);
    y += 14;
  }

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  if (options.filters?.length) {
    doc.text(`Filtros: ${options.filters.join(" | ")}`, margin, y);
    y += 12;
  }
  if (options.summary?.length) {
    options.summary.forEach((s) => {
      doc.text(`${s.label}: ${s.value}`, margin, y);
      y += 12;
    });
  }

  const head = [options.columns.map((c) => c.header)];
  const body = options.rows.map((row) => options.columns.map((c) => String(row[c.key] ?? "")));

  autoTable(doc, {
    startY: y + 6,
    head,
    body,
    margin: { left: margin, right: margin },
    styles: { fontSize: 9, cellPadding: 6, overflow: "linebreak" },
    headStyles: { fillColor: [30, 136, 229], textColor: 255 },
    alternateRowStyles: { fillColor: [246, 248, 252] },
  });

  doc.save(`${options.fileBaseName}_${timestamp()}.pdf`);
}

