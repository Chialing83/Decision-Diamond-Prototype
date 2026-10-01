import React from 'react'
import { cn } from './cn'

export interface DashboardGridProps extends React.HTMLAttributes<HTMLDivElement> {}

/** Page-level 12-col grid wrapper. Max-width 1440, fluid padding. */
export function DashboardGrid({ className, children, ...rest }: DashboardGridProps) {
  return (
    <div
      className={cn('mx-auto w-full max-w-[1440px] px-4 py-6 md:px-6 lg:px-8', className)}
      {...rest}
    >
      <div className="grid grid-cols-12 gap-gutter">{children}</div>
    </div>
  )
}

export type SpanValue = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12

export interface GridSpan {
  base?: SpanValue
  sm?: SpanValue
  md?: SpanValue
  lg?: SpanValue
  xl?: SpanValue
}

/* Static class lookup — Tailwind's scanner needs to see these literals. */
const baseSpan: Record<SpanValue, string> = {
  1: 'col-span-1',
  2: 'col-span-2',
  3: 'col-span-3',
  4: 'col-span-4',
  5: 'col-span-5',
  6: 'col-span-6',
  7: 'col-span-7',
  8: 'col-span-8',
  9: 'col-span-9',
  10: 'col-span-10',
  11: 'col-span-11',
  12: 'col-span-12',
}

const smSpan: Record<SpanValue, string> = {
  1: 'sm:col-span-1',
  2: 'sm:col-span-2',
  3: 'sm:col-span-3',
  4: 'sm:col-span-4',
  5: 'sm:col-span-5',
  6: 'sm:col-span-6',
  7: 'sm:col-span-7',
  8: 'sm:col-span-8',
  9: 'sm:col-span-9',
  10: 'sm:col-span-10',
  11: 'sm:col-span-11',
  12: 'sm:col-span-12',
}

const mdSpan: Record<SpanValue, string> = {
  1: 'md:col-span-1',
  2: 'md:col-span-2',
  3: 'md:col-span-3',
  4: 'md:col-span-4',
  5: 'md:col-span-5',
  6: 'md:col-span-6',
  7: 'md:col-span-7',
  8: 'md:col-span-8',
  9: 'md:col-span-9',
  10: 'md:col-span-10',
  11: 'md:col-span-11',
  12: 'md:col-span-12',
}

const lgSpan: Record<SpanValue, string> = {
  1: 'lg:col-span-1',
  2: 'lg:col-span-2',
  3: 'lg:col-span-3',
  4: 'lg:col-span-4',
  5: 'lg:col-span-5',
  6: 'lg:col-span-6',
  7: 'lg:col-span-7',
  8: 'lg:col-span-8',
  9: 'lg:col-span-9',
  10: 'lg:col-span-10',
  11: 'lg:col-span-11',
  12: 'lg:col-span-12',
}

const xlSpan: Record<SpanValue, string> = {
  1: 'xl:col-span-1',
  2: 'xl:col-span-2',
  3: 'xl:col-span-3',
  4: 'xl:col-span-4',
  5: 'xl:col-span-5',
  6: 'xl:col-span-6',
  7: 'xl:col-span-7',
  8: 'xl:col-span-8',
  9: 'xl:col-span-9',
  10: 'xl:col-span-10',
  11: 'xl:col-span-11',
  12: 'xl:col-span-12',
}

export interface GridItemProps extends React.HTMLAttributes<HTMLDivElement> {
  span?: GridSpan
}

export function GridItem({ span, className, children, ...rest }: GridItemProps) {
  const base = span?.base ?? 12
  return (
    <div
      className={cn(
        baseSpan[base],
        span?.sm ? smSpan[span.sm] : undefined,
        span?.md ? mdSpan[span.md] : undefined,
        span?.lg ? lgSpan[span.lg] : undefined,
        span?.xl ? xlSpan[span.xl] : undefined,
        className,
      )}
      {...rest}
    >
      {children}
    </div>
  )
}
