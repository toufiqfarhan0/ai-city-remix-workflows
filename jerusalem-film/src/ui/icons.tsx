// Inline line icons (24 viewBox, stroke 2, round caps), drawn for this scene. No icon font and no
// external sprite, so the single-file build stays offline.
import type { ReactNode } from 'react'

interface IconProps {
  size?: number
  strokeWidth?: number
}

function icon(paths: ReactNode) {
  return function Icon({ size = 16, strokeWidth = 2 }: IconProps) {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        focusable="false"
      >
        {paths}
      </svg>
    )
  }
}

export const ArrowUpRight = icon(<path d="M7 17 17 7M8 7h9v9" />)
export const Sun = icon(
  <>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M5.6 18.4 7 17M17 7l1.4-1.4" />
  </>,
)
export const Moon = icon(<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5Z" />)
export const RotateCw = icon(
  <>
    <path d="M20 12a8 8 0 1 1-2.6-5.9" />
    <path d="M20 4v5h-5" />
  </>,
)
export const RotateCcw = icon(
  <>
    <path d="M4 12a8 8 0 1 0 2.6-5.9" />
    <path d="M4 4v5h5" />
  </>,
)
export const Plus = icon(<path d="M12 5v14M5 12h14" />)
export const Minus = icon(<path d="M5 12h14" />)
export const Camera = icon(
  <>
    <path d="M4 8h3l2-3h6l2 3h3v11H4Z" />
    <circle cx="12" cy="13" r="3.5" />
  </>,
)
export const Maximize = icon(<path d="M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5" />)
export const MapPin = icon(
  <>
    <path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21Z" />
    <circle cx="12" cy="9.5" r="2.5" />
  </>,
)
export const MoveUpRight = icon(<path d="M8 16 16 8M10 8h6v6" />)
export const MousePointer2 = icon(<path d="M5 3l14 7-6 2-2 6Z" />)
export const X = icon(<path d="M6 6l12 12M18 6 6 18" />)
export const Compass = icon(
  <>
    <circle cx="12" cy="12" r="9" />
    <path d="m15.5 8.5-2 5-5 2 2-5Z" />
  </>,
)
