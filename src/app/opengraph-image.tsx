import { ImageResponse } from 'next/og';
import { siteConfig } from '@/config/site';

export const runtime = 'edge';
export const alt = `${siteConfig.name} — AI Trading Journal & Performance Analytics`;
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

/** Dynamic OG/Twitter card. Token-consistent colors, no external assets/fonts. */
export default function OgImage() {
  return new ImageResponse(
    <div
      style={{
        height: '100%',
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        background: '#0A0B0E',
        padding: '80px',
        fontFamily: 'sans-serif',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '18px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: '4px' }}>
          <div style={{ height: 22, width: 52, background: '#5B6CFF', borderRadius: 6 }} />
          <div style={{ height: 22, width: 52, background: '#F3F5F9', borderRadius: 6 }} />
        </div>
        <div style={{ fontSize: 40, fontWeight: 700, color: '#F3F5F9' }}>{siteConfig.name}</div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        <div
          style={{
            fontSize: 68,
            fontWeight: 700,
            color: '#F3F5F9',
            lineHeight: 1.1,
            maxWidth: 1000,
          }}
        >
          The AI trading journal that proves your edge with{' '}
          <span style={{ color: '#5B6CFF' }}>verified data</span>
        </div>
        <div style={{ fontSize: 30, color: '#A5ACBB' }}>{siteConfig.tagline}</div>
      </div>
    </div>,
    { ...size },
  );
}
