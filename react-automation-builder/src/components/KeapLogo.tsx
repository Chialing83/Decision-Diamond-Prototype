import React from 'react'
import { CatLogo } from './CatLogo'

/**
 * Brand-mark slot. During the locked-down preview build this
 * forwards to `CatLogo` so every surface that imported `KeapLogo`
 * picks up the cat illustration without further changes. To unlock
 * the build later, swap the body back to `<DexKeapLogo />`.
 */
export function KeapLogo({ size = 27 }: { size?: number }) {
  return <CatLogo size={size} />
}
