import React from 'react'

/**
 * Whimsical cat-face logo standing in for the Keap brand mark during
 * the locked-down preview build. Original artwork — simple geometric
 * shapes only (triangles for ears, circle for the head, dots for
 * eyes, a tiny triangle nose, soft arcs for whiskers and a smile).
 *
 * Sized via `size` (height in px). Width is derived from a 36:54
 * viewBox to match the slot the old Keap "K" lived in, so the
 * sidebar layout stays pixel-stable.
 *
 * `tone` controls the ginger fill. Default `#F38F1F` is a warm
 * orange that fills the same visual role as the old brand mark
 * without copying it.
 */
export function CatLogo({
  size = 27,
  tone = '#F38F1F',
}: {
  size?: number
  tone?: string
}) {
  const width = size * (36 / 54)
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 36 54"
      width={width}
      height={size}
      aria-label="Cat (preview build)"
      role="img"
    >
      {/* Ears — two triangles tipped slightly inward. */}
      <path d="M3 18 L8 4 L15 19 Z" fill={tone} />
      <path d="M21 19 L28 4 L33 18 Z" fill={tone} />
      {/* Inner ear tints — small soft-pink inset for life. */}
      <path d="M6.5 16 L8.8 8 L12.2 17 Z" fill="#FBD1A2" />
      <path d="M23.8 17 L27.2 8 L30 16 Z" fill="#FBD1A2" />

      {/* Round head. */}
      <circle cx="18" cy="28" r="14" fill={tone} />

      {/* Eyes — two dark almond dots. */}
      <ellipse cx="12" cy="26" rx="1.6" ry="2.4" fill="#1A1A1A" />
      <ellipse cx="24" cy="26" rx="1.6" ry="2.4" fill="#1A1A1A" />
      {/* Tiny catchlights so the eyes feel alive. */}
      <circle cx="11.4" cy="25.2" r="0.55" fill="#FFFFFF" />
      <circle cx="23.4" cy="25.2" r="0.55" fill="#FFFFFF" />

      {/* Triangular nose. */}
      <path
        d="M16.5 31.2 L19.5 31.2 L18 33.4 Z"
        fill="#E26A87"
        stroke="#A24359"
        strokeWidth="0.4"
        strokeLinejoin="round"
      />

      {/* Smile — two gentle arcs meeting under the nose. */}
      <path
        d="M14.5 35 Q18 38 21.5 35"
        stroke="#1A1A1A"
        strokeWidth="1.1"
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M18 33.4 L18 35"
        stroke="#1A1A1A"
        strokeWidth="0.9"
        strokeLinecap="round"
      />

      {/* Whiskers — three on each side, faintly drawn. */}
      <g stroke="#1A1A1A" strokeWidth="0.55" strokeLinecap="round" fill="none">
        <path d="M3.5 30 L9.5 30" />
        <path d="M3.8 32.4 L9.6 31.4" />
        <path d="M4.2 28 L9.6 28.8" />
        <path d="M26.5 30 L32.5 30" />
        <path d="M26.4 31.4 L32.2 32.4" />
        <path d="M26.4 28.8 L31.8 28" />
      </g>
    </svg>
  )
}
