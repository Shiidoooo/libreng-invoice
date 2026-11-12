import { createRoot } from 'react-dom/client';
import type { BusinessProfile } from '../business/types';
import { DocumentPreview } from './DocumentPreview';
import { PDF_SHEET_WIDTH_PX, createDocumentPdf } from './documentPdf';
import type { BusinessDocument } from './types';

/** Resolves with the sheet element once React has put it in the page. */
function waitForSheet(host: HTMLElement): Promise<HTMLElement> {
  return new Promise((resolve) => {
    const observer = new MutationObserver(() => {
      const sheet = host.querySelector<HTMLElement>('.sheet');
      if (!sheet) return;
      observer.disconnect();
      resolve(sheet);
    });
    observer.observe(host, { childList: true, subtree: true });
  });
}

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
    // This may be called while React is rendering (from an effect), so the sheet is
    // rendered normally and we wait for it, rather than forcing a synchronous render.
    const sheetReady = waitForSheet(host);
    root.render(<DocumentPreview document={document} profile={profile} />);
    const sheet = await sheetReady;
    // The capture must not start before the fonts and the logo are ready, or the PDF
    // would show fallback fonts or a missing logo.
    await window.document.fonts.ready;
    await Promise.all([...host.querySelectorAll('img')].map((image) => image.decode().catch(() => undefined)));
    return await createDocumentPdf(sheet, document.number);
  } finally {
    root.unmount();
    host.remove();
  }
}
