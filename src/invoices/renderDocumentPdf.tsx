import { flushSync } from 'react-dom';
import { createRoot } from 'react-dom/client';
import type { BusinessProfile } from '../business/types';
import { DocumentPreview } from './DocumentPreview';
import { PDF_SHEET_WIDTH_PX, createDocumentPdf } from './documentPdf';
import type { BusinessDocument } from './types';

/**
 * Makes the PDF file of a document without touching what is on screen: the sheet is laid
 * out off-screen at A4 width (so a phone gets the same PDF as a computer), captured, and
 * removed again.
 */
export async function renderDocumentPdf(document: BusinessDocument, profile: BusinessProfile): Promise<File> {
  const host = window.document.createElement('div');
  host.className = 'pdf-render-area';
  host.style.width = `${PDF_SHEET_WIDTH_PX}px`;
  host.setAttribute('aria-hidden', 'true');
  window.document.body.appendChild(host);
  const root = createRoot(host);
  try {
    flushSync(() => root.render(<DocumentPreview document={document} profile={profile} />));
    // The capture must not start before the fonts and the logo are ready, or the PDF
    // would show fallback fonts or a missing logo.
    await window.document.fonts.ready;
    await Promise.all([...host.querySelectorAll('img')].map((image) => image.decode().catch(() => undefined)));
    const sheet = host.querySelector<HTMLElement>('.sheet');
    if (!sheet) throw new Error('The document sheet did not render');
    return await createDocumentPdf(sheet, document.number);
  } finally {
    root.unmount();
    host.remove();
  }
}
