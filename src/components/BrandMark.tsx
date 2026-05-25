import { useThemeStore } from '../store/theme'

interface BrandMarkProps {
  theme?: 'light' | 'dark'
  size?: number
}

export default function BrandMark({ theme: themeProp, size = 36 }: BrandMarkProps) {
  const storeTheme = useThemeStore((s) => s.theme)
  const t = themeProp ?? storeTheme

  const paper   = t === 'dark' ? '#161f2c' : '#fffaee'
  const ink     = t === 'dark' ? '#f3e8cc' : '#1a1814'
  const accent  = t === 'dark' ? '#ff8568' : '#c13b2a'
  const inkMuted = t === 'dark' ? '#7a6c4d' : '#8a6f45'

  return (
    <svg width={size} height={size} viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
      <rect x="6" y="8" width="52" height="48" rx="5" fill={paper} stroke={ink} strokeWidth="2.5" />
      <g transform="rotate(-3 32 12)">
        <rect
          x="18" y="4" width="28" height="9"
          fill="#f4d35e"
          opacity={t === 'dark' ? 0.55 : 0.92}
          stroke={t === 'dark' ? 'rgba(0,0,0,0.4)' : 'rgba(120,90,30,0.3)'}
          strokeWidth="0.5"
        />
      </g>
      <g fill={accent}>
        <rect x="33.2" y="17" width="2.6" height="22.5" />
        <path d="M35.8 17 Q 43 19, 44 26 Q 43 24, 35.8 24 Z" />
        <ellipse cx="28" cy="40" rx="6.4" ry="4.6" transform="rotate(-22 28 40)" />
      </g>
      <text
        x="32" y="52"
        textAnchor="middle"
        fontFamily="'JetBrains Mono', ui-monospace, monospace"
        fontSize="6.5"
        fontWeight="700"
        fill={inkMuted}
        letterSpacing="0.8"
      >
        p / p
      </text>
    </svg>
  )
}
