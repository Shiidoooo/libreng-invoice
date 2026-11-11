import { describe, expect, it } from 'vitest';
import { pdfFileName, planPageSlices } from './documentPdf';

describe('planPageSlices', () => {
  it('keeps a short document on one page', () => {
    expect(planPageSlices(800, 1000, [200, 500, 800])).toEqual([[0, 800]]);
  });

  it('breaks between rows instead of through them', () => {
    expect(planPageSlices(1800, 1000, [300, 950, 1020, 1800])).toEqual([
      [0, 950],
      [950, 1800],
    ]);
  });

  it('cuts at the page edge when no row ends in a sensible place', () => {
    // The only break is very near the top, which would leave a mostly empty page.
    expect(planPageSlices(2500, 1000, [100])).toEqual([
      [0, 1000],
      [1000, 2000],
      [2000, 2500],
    ]);
  });
});

describe('pdfFileName', () => {
  it('uses the document number with unsafe characters replaced', () => {
    expect(pdfFileName('INV-2026-0012')).toBe('INV-2026-0012.pdf');
    expect(pdfFileName('JOB/17 a')).toBe('JOB_17_a.pdf');
    expect(pdfFileName('')).toBe('document.pdf');
  });
});
