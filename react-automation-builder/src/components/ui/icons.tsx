import React from 'react'

/**
 * Pixel-perfect Keap icons.
 *
 * These replicate the exact SVG paths from Keap's production UI so card footer
 * affordances (+, →) match the reference design at the pixel level. Apply
 * `className="text-accent"` to render them in the blue accent color.
 *
 * Lucide equivalents (`PlusCircle`, `ArrowRight`) are stroke-based and render
 * slightly differently; use these when pixel-parity with the reference
 * matters.
 */

type Props = React.SVGProps<SVGSVGElement>

export function KeapPlusCircle({ className, ...rest }: Props) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={16}
      height={16}
      aria-hidden="true"
      className={className}
      {...rest}
    >
      <path
        fill="currentColor"
        fillRule="evenodd"
        d="M12 1c6.075 0 11 4.925 11 11s-4.925 11-11 11S1 18.075 1 12 5.925 1 12 1m0 2a9 9 0 1 0 0 18 9 9 0 0 0 0-18m4.707 4.293a1 1 0 0 1 .226 1.066l-2.222 5.778a1 1 0 0 1-.574.574l-5.778 2.222a1 1 0 0 1-1.292-1.292l2.222-5.778a1 1 0 0 1 .574-.574l5.778-2.222a1 1 0 0 1 1.066.226M14.26 9.74l-3.263 1.255-1.255 3.263 3.263-1.255z"
      />
    </svg>
  )
}

export function KeapArrowRight({ className, ...rest }: Props) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={16}
      height={16}
      aria-hidden="true"
      className={className}
      {...rest}
    >
      <path
        fill="currentColor"
        fillRule="evenodd"
        d="m17.707 6.293 5 5a1 1 0 0 1 .292.707v.033l-.004.052A1 1 0 0 1 22.78 12.625l-.073.082-5 5a1 1 0 0 1-1.414-1.414L19.584 13H2a1 1 0 1 1 0-2h17.586l-3.293-3.293a1 1 0 0 1 1.414-1.414Z"
      />
    </svg>
  )
}
