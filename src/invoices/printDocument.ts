/**
 * Opens the browser's print dialog, where "Save as PDF" produces the file.
 * The page title becomes the suggested PDF file name.
 */
export function printDocument(documentNumber: string) {
  const previousTitle = window.document.title;
  window.document.title = documentNumber.replace(/[^\w.-]+/g, '_') || 'document';
  window.addEventListener('afterprint', () => (window.document.title = previousTitle), { once: true });
  window.print();
}
