/**
 * Turns the rendered document sheet into a real PDF file, so it can be shared to Gmail,
 * Messenger or Viber as an attachment, or downloaded. The PDF libraries are loaded only
 * when this runs, so they never slow down the first page load.
 */
import { AppError } from '../errors/appError';

/** A4 in millimetres, with a margin around the sheet. */
const PAGE_WIDTH_MM = 210;
const PAGE_HEIGHT_MM = 297;
const MARGIN_MM = 10;
const CONTENT_WIDTH_MM = PAGE_WIDTH_MM - 2 * MARGIN_MM;
const CONTENT_HEIGHT_MM = PAGE_HEIGHT_MM - 2 * MARGIN_MM;

/** Rendering scale: sharp text on phones and printers while keeping files small. */
const RENDER_SCALE = 2;
const JPEG_QUALITY = 0.9;

/** The width the sheet is laid out at before capture (A4 at 96 dpi, minus margins). */
export const PDF_SHEET_WIDTH_PX = 718;

export function pdfFileName(documentNumber: string): string {
  return `${documentNumber.replace(/[^\w.-]+/g, '_') || 'document'}.pdf`;
}

/**
 * Page breaks fall between table rows and sections, never through a line of text.
 * Returns the bottom edge (in canvas pixels) of every block that may end a page.
 */
function findBreakPoints(sheet: HTMLElement, scale: number): number[] {
  const top = sheet.getBoundingClientRect().top;
  const blocks = sheet.querySelectorAll<HTMLElement>(':scope > *, tr, .sheet-totals > *');
  return [...blocks]
    .map((block) => Math.round((block.getBoundingClientRect().bottom - top) * scale))
    .sort((a, b) => a - b);
}

/** Chooses page slices of at most pageHeight, ending on a break point when one fits. */
export function planPageSlices(totalHeight: number, pageHeight: number, breakPoints: number[]): Array<[number, number]> {
  const slices: Array<[number, number]> = [];
  let start = 0;
  while (start < totalHeight) {
    const limit = start + pageHeight;
    if (limit >= totalHeight) {
      slices.push([start, totalHeight]);
      break;
    }
    const lastFittingBreak = breakPoints.filter((point) => point > start && point <= limit).at(-1);
    // A single block taller than a page has no break that fits; cut it at the page edge.
    const end = lastFittingBreak !== undefined && lastFittingBreak - start > pageHeight / 3 ? lastFittingBreak : limit;
    slices.push([start, end]);
    start = end;
  }
  return slices;
}

export async function createDocumentPdf(sheet: HTMLElement, documentNumber: string): Promise<File> {
  try {
    const [{ default: html2canvas }, { jsPDF }] = await Promise.all([import('html2canvas-pro'), import('jspdf')]);
    const canvas = await html2canvas(sheet, { scale: RENDER_SCALE, backgroundColor: '#ffffff', logging: false });

    const pageHeightPx = Math.floor((canvas.width * CONTENT_HEIGHT_MM) / CONTENT_WIDTH_MM);
    const slices = planPageSlices(canvas.height, pageHeightPx, findBreakPoints(sheet, RENDER_SCALE));
    const pdf = new jsPDF({ unit: 'mm', format: 'a4', compress: true });
    pdf.setProperties({ title: documentNumber });

    slices.forEach(([start, end], index) => {
      const page = window.document.createElement('canvas');
      page.width = canvas.width;
      page.height = end - start;
      const context = page.getContext('2d');
      if (!context) throw new Error('Canvas 2D context is not available');
      context.fillStyle = '#ffffff';
      context.fillRect(0, 0, page.width, page.height);
      context.drawImage(canvas, 0, start, canvas.width, page.height, 0, 0, canvas.width, page.height);

      if (index > 0) pdf.addPage();
      const heightMm = (page.height * CONTENT_WIDTH_MM) / canvas.width;
      pdf.addImage(page.toDataURL('image/jpeg', JPEG_QUALITY), 'JPEG', MARGIN_MM, MARGIN_MM, CONTENT_WIDTH_MM, heightMm);
    });

    return new File([pdf.output('blob')], pdfFileName(documentNumber), { type: 'application/pdf' });
  } catch (error) {
    throw new AppError('internal', 'Could not make the PDF on this device. Use Print and choose “Save as PDF” instead.', {
      cause: error,
    });
  }
}

/** True when this device can attach a PDF to Gmail, Messenger, Viber… through the share sheet. */
export function canShareFile(file: File): boolean {
  return typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] });
}

/** Saves the file to the device's Downloads folder. */
export function downloadFile(file: File): void {
  const url = URL.createObjectURL(file);
  const link = window.document.createElement('a');
  link.href = url;
  link.download = file.name;
  link.click();
  // Give the browser time to start the download before the URL is released.
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
