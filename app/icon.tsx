import { ImageResponse } from 'next/og'

export const size = { width: 64, height: 64 }
export const contentType = 'image/png'

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#0B0F14',
          color: '#0F93FF',
          fontSize: 42,
          fontWeight: 700,
          borderRadius: 12,
        }}
      >
        TY
      </div>
    ),
    size
  )
}

