'use client';
import { useState } from 'react';
import { FileDown, FileSpreadsheet } from 'lucide-react';
import { Button } from './ui';
import { logExport } from '@/app/actions/teacher';

export type ExportColumn = { key: string; header: string };
export type ExportRow = Record<string, string | number | null | undefined>;

/**
 * Client-side PDF / Excel export of a table already loaded (and permission-checked) on the server.
 * PDF uses English headers because the built-in PDF fonts have no Japanese glyphs;
 * the Excel file keeps all text (including Japanese) exactly.
 */
export function ExportButtons({ title, filename, columns, pdfColumns, rows, subtitle, log = true }: {
  title: string; filename: string; columns: ExportColumn[]; pdfColumns?: ExportColumn[]; rows: ExportRow[]; subtitle?: string; log?: boolean;
}) {
  const [busy, setBusy] = useState(false);

  async function pdf() {
    setBusy(true);
    try {
      const { jsPDF } = await import('jspdf');
      const { autoTable } = await import('jspdf-autotable');
      const cols = pdfColumns ?? columns;
      const doc = new jsPDF({ orientation: cols.length > 6 ? 'landscape' : 'portrait' });
      const ascii = (v: unknown) => String(v ?? '').replace(/[^\x20-\x7E]/g, '?');
      doc.setFontSize(14); doc.text(ascii(title), 14, 16);
      doc.setFontSize(9); doc.setTextColor(100);
      doc.text(ascii(subtitle ?? `Generated ${new Date().toLocaleString('en-GB', { timeZone: 'Asia/Tokyo' })} JST`), 14, 22);
      autoTable(doc, {
        startY: 27,
        head: [cols.map((c) => ascii(c.header))],
        body: rows.map((r) => cols.map((c) => ascii(r[c.key]))),
        styles: { fontSize: 8, cellPadding: 1.5 },
        headStyles: { fillColor: [37, 99, 235] },
        didParseCell: (d) => {
          const v = String(d.cell.raw ?? '').toLowerCase();
          if (d.section === 'body' && (v === 'red' || v === 'over limit')) d.cell.styles.textColor = [220, 38, 38];
          if (d.section === 'body' && (v === 'yellow' || v === 'approaching limit')) d.cell.styles.textColor = [180, 120, 0];
        },
      });
      doc.save(`${filename}.pdf`);
      if (log) logExport('pdf', { filename, rows: rows.length });
    } finally { setBusy(false); }
  }

  async function excel() {
    setBusy(true);
    try {
      const writeXlsxFile = (await import('write-excel-file')).default;
      const header = columns.map((c) => ({ value: c.header, fontWeight: 'bold' as const, backgroundColor: '#DBEAFE' }));
      const body = rows.map((r) => columns.map((c) => {
        const v = r[c.key];
        return typeof v === 'number' ? { type: Number, value: v } : { type: String, value: v == null ? '' : String(v) };
      }));
      await writeXlsxFile([[{ value: title, fontWeight: 'bold' as const }], [], header, ...body] as any, {
        fileName: `${filename}.xlsx`,
        columns: columns.map(() => ({ width: 18 })),
      });
      if (log) logExport('excel', { filename, rows: rows.length });
    } finally { setBusy(false); }
  }

  return (
    <div className="no-print flex gap-2">
      <Button variant="outline" size="sm" onClick={pdf} disabled={busy}><FileDown className="h-4 w-4" />PDF</Button>
      <Button variant="outline" size="sm" onClick={excel} disabled={busy}><FileSpreadsheet className="h-4 w-4" />Excel</Button>
    </div>
  );
}
