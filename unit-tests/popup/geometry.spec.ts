import { computeConnectedPopupPosition as computePopupPosition } from '@rivinia/popup';

describe('computePopupPosition', () => {
  const viewport = { left: 0, top: 0, right: 400, bottom: 300 };

  it('places logical start below the origin in LTR', () => {
    expect(
      computePopupPosition({
        origin: { left: 100, top: 40, width: 80, height: 20 },
        panel: { width: 120, height: 60 },
        viewport,
        direction: 'ltr',
        offset: 8,
      }),
    ).toEqual({ left: 100, top: 68, placement: 'bottom-start' });
  });

  it('aligns logical start to the right edge in RTL', () => {
    expect(
      computePopupPosition({
        origin: { left: 100, top: 40, width: 80, height: 20 },
        panel: { width: 120, height: 60 },
        viewport,
        direction: 'rtl',
        offset: 8,
      }),
    ).toEqual({ left: 60, top: 68, placement: 'bottom-start' });
  });

  it('flips to the opposite side when the requested side cannot fit', () => {
    expect(
      computePopupPosition({
        origin: { left: 100, top: 250, width: 80, height: 20 },
        panel: { width: 120, height: 80 },
        viewport,
        direction: 'ltr',
        offset: 8,
      }),
    ).toEqual({ left: 100, top: 162, placement: 'top-start' });
  });

  it('clamps the panel inside the viewport after choosing its side', () => {
    expect(
      computePopupPosition({
        origin: { left: 380, top: 40, width: 30, height: 20 },
        panel: { width: 120, height: 60 },
        viewport,
        direction: 'ltr',
        offset: 8,
        padding: 12,
      }),
    ).toEqual({ left: 268, top: 68, placement: 'bottom-start' });
  });

  it('supports explicit side and logical alignment preferences', () => {
    expect(
      computePopupPosition({
        origin: { left: 100, top: 100, width: 80, height: 20 },
        panel: { width: 40, height: 30 },
        viewport,
        direction: 'ltr',
        placement: 'top-end',
        offset: 4,
      }),
    ).toEqual({ left: 140, top: 66, placement: 'top-end' });
  });

  it('positions right-end with vertical end alignment', () => {
    expect(
      computePopupPosition({
        origin: { left: 100, top: 90, width: 40, height: 30 },
        panel: { width: 50, height: 70 },
        viewport,
        direction: 'ltr',
        placement: 'right-end',
        offset: 6,
        padding: 8,
      }),
    ).toEqual({ left: 146, top: 50, placement: 'right-end' });
  });

  it('flips a right-side popup to the left near the viewport edge', () => {
    expect(
      computePopupPosition({
        origin: { left: 365, top: 100, width: 20, height: 30 },
        panel: { width: 80, height: 50 },
        viewport,
        direction: 'ltr',
        placement: 'right-start',
        offset: 8,
        padding: 10,
      }),
    ).toEqual({ left: 277, top: 100, placement: 'left-start' });
  });

  it('aligns logical end correctly in RTL', () => {
    expect(
      computePopupPosition({
        origin: { left: 100, top: 40, width: 80, height: 20 },
        panel: { width: 120, height: 60 },
        viewport,
        direction: 'rtl',
        placement: 'bottom-end',
      }),
    ).toEqual({ left: 100, top: 60, placement: 'bottom-end' });
  });

  it('honors non-zero viewport bounds when flipping and clamping', () => {
    expect(
      computePopupPosition({
        origin: { left: 440, top: 300, width: 40, height: 20 },
        panel: { width: 90, height: 60 },
        viewport: { left: 100, top: 50, right: 500, bottom: 350 },
        direction: 'ltr',
        placement: 'bottom-start',
        offset: 8,
        padding: 12,
      }),
    ).toEqual({ left: 398, top: 232, placement: 'top-start' });
  });
});
