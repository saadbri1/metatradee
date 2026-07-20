import { readFileSync, readdirSync } from 'node:fs';
import { extname, join, resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';
import type { Candle } from '@/features/chart/types';
import type { ChartProvider } from '@/features/chart/provider/chart-provider';
import { PriceChart } from '@/features/chart/components/price-chart';

const CANDLES: Candle[] = [
  { time: 100, open: 10, high: 12, low: 9, close: 11, volume: 50 },
  { time: 200, open: 11, high: 13, low: 10, close: 12, volume: 70 },
];

function fakeProvider() {
  const unsubscribe = vi.fn();
  const provider: ChartProvider = {
    initialize: vi.fn(),
    destroy: vi.fn(),
    setCandles: vi.fn(),
    updateCandle: vi.fn(),
    setVolumeVisible: vi.fn(),
    setMarkers: vi.fn(),
    setOrderLines: vi.fn(),
    setScaleLocked: vi.fn(),
    fitContent: vi.fn(),
    resetView: vi.fn(),
    subscribeCrosshair: vi.fn(() => unsubscribe),
    setCrosshairMode: vi.fn(),
    setWatermark: vi.fn(),
    setOrderAnnotationsVisible: vi.fn(),
  };
  return { provider, unsubscribe };
}

describe('provider-neutral React boundary', () => {
  it('passes candles, markers, lines, and working controls through the provider interface', () => {
    const { provider } = fakeProvider();
    const lines = [
      { id: 'line', price: 10, role: 'entry' as const, side: 'buy' as const, label: 'Buy' },
    ];
    const markers = [
      {
        id: 'fill',
        time: 200,
        price: 12,
        side: 'buy' as const,
        kind: 'entry_fill' as const,
        label: 'Buy fill',
      },
    ];
    render(
      <PriceChart
        candles={CANDLES}
        watermark="ESM2 · 1m"
        priceScaleLocked
        fitRequest={1}
        resetRequest={1}
        volumeVisible={false}
        crosshairMode="magnet"
        orderAnnotationsVisible={false}
        orderLines={lines}
        fillMarkers={markers}
        providerFactory={() => provider}
      />,
    );

    expect(provider.initialize).toHaveBeenCalledOnce();
    expect(provider.setCandles).toHaveBeenLastCalledWith(CANDLES);
    expect(provider.setOrderLines).toHaveBeenLastCalledWith(lines);
    expect(provider.setMarkers).toHaveBeenLastCalledWith(markers);
    expect(provider.setScaleLocked).toHaveBeenLastCalledWith(true);
    expect(provider.setVolumeVisible).toHaveBeenLastCalledWith(false);
    expect(provider.setCrosshairMode).toHaveBeenLastCalledWith('magnet');
    expect(provider.setWatermark).toHaveBeenLastCalledWith('ESM2 · 1m');
    expect(provider.setOrderAnnotationsVisible).toHaveBeenLastCalledWith(false);
    expect(provider.fitContent).toHaveBeenCalledOnce();
    expect(provider.resetView).toHaveBeenCalledOnce();
  });

  it('cleans up the crosshair subscription and destroys the provider', () => {
    const { provider, unsubscribe } = fakeProvider();
    const { unmount } = render(<PriceChart candles={CANDLES} providerFactory={() => provider} />);
    unmount();
    expect(unsubscribe).toHaveBeenCalledOnce();
    expect(provider.destroy).toHaveBeenCalledOnce();
  });
});

describe('vendor import boundary', () => {
  it('keeps the Lightweight Charts import inside the adapter only', () => {
    const root = resolve(__dirname, '../../..');
    const sourceRoot = resolve(root, 'src');
    const matches: string[] = [];
    const visit = (directory: string) => {
      for (const entry of readdirSync(directory, { withFileTypes: true })) {
        const path = join(directory, entry.name);
        if (entry.isDirectory()) visit(path);
        else if (['.ts', '.tsx'].includes(extname(entry.name))) {
          const source = readFileSync(path, 'utf8');
          if (/from ['"]lightweight-charts['"]/.test(source)) matches.push(path);
        }
      }
    };
    visit(sourceRoot);
    expect(matches).toEqual([
      resolve(root, 'src/features/chart/provider/lightweight-chart-provider.ts'),
    ]);
  });

  it('keeps React and vendor types out of the pure contract and workspace', () => {
    const root = resolve(__dirname, '../../..');
    const contract = readFileSync(resolve(root, 'src/features/chart/provider/types.ts'), 'utf8');
    const workspace = readFileSync(
      resolve(root, 'src/features/chart/components/chart-workspace.tsx'),
      'utf8',
    );
    expect(contract).not.toMatch(/from ['"]react['"]/);
    expect(contract).not.toContain('lightweight-charts');
    expect(workspace).not.toContain('lightweight-charts');
  });
});
