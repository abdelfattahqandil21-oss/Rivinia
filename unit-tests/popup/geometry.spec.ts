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
});
