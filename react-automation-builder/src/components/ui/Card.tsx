import React from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from './cn'
import { KebabMenu, type KebabMenuItem } from './KebabMenu'

export type CardVariant = 'kpi' | 'list' | 'empty' | 'progress'

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: CardVariant
  loading?: boolean
}

const cardFrame =
  'group relative flex flex-col rounded-card bg-surface border border-border shadow-card p-card min-h-[180px] transition-shadow duration-150 hover:shadow-card-hover hover:border-border-strong motion-reduce:transition-none'

function CardRoot({ variant, loading, className, children, ...rest }: CardProps) {
  // `variant` is declarative — it does not change the frame, only signals intent
  // to callers/screen readers. Body composition is left to the consumer.
  return (
    <div
      data-variant={variant}
      aria-busy={loading || undefined}
      className={cn(cardFrame, className)}
      {...rest}
    >
      {loading ? <CardSkeleton variant={variant} /> : children}
    </div>
  )
}

export interface CardHeaderProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'title'> {
  title?: React.ReactNode
  /** Pass menu items to render a trailing <KebabMenu />. If omitted, no menu
   *  renders. Pass `menu={null}` to explicitly hide even the reserved slot. */
  menu?: KebabMenuItem[] | null
  /** Fully custom trailing slot (takes precedence over `menu`). */
  trailing?: React.ReactNode
}

function CardHeader({
  title,
  menu,
  trailing,
  className,
  children,
  ...rest
}: CardHeaderProps) {
  return (
    <div
      className={cn('flex items-start justify-between gap-2', className)}
      {...rest}
    >
      <div className="min-w-0 flex-1">
        {title !== undefined ? (
          <div className="text-sm font-semibold text-ink truncate">{title}</div>
        ) : null}
        {children}
      </div>
      {trailing !== undefined ? (
        trailing
      ) : menu && menu.length > 0 ? (
        <KebabMenu items={menu} />
      ) : null}
    </div>
  )
}

export interface CardMetaProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Renders a trailing chevron to signal the meta is a dropdown trigger. */
  interactive?: boolean
}

function CardMeta({ interactive, className, children, ...rest }: CardMetaProps) {
  return (
    <div
      className={cn(
        'mt-1 text-xs font-medium text-ink-muted flex items-center gap-1',
        className,
      )}
      {...rest}
    >
      <span>{children}</span>
      {interactive ? <ChevronDown className="h-3 w-3" aria-hidden="true" /> : null}
    </div>
  )
}

function CardBody({ className, children, ...rest }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('mt-3 flex-1', className)} {...rest}>
      {children}
    </div>
  )
}

function CardFooter({
  className,
  children,
  ...rest
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('mt-4 flex items-center justify-between text-accent', className)}
      {...rest}
    >
      {children}
    </div>
  )
}

function CardSkeleton({ variant }: { variant?: CardVariant }) {
  // Skeleton shape loosely tracks the variant body so the layout doesn't jump
  // when data resolves.
  return (
    <>
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 space-y-2">
          <div className="h-3 w-24 animate-pulse rounded bg-border/60 motion-reduce:animate-none" />
          <div className="h-2 w-16 animate-pulse rounded bg-border/60 motion-reduce:animate-none" />
        </div>
        <div className="h-8 w-8 animate-pulse rounded-full bg-border/60 motion-reduce:animate-none" />
      </div>
      <div className="mt-4 flex-1 space-y-2">
        {variant === 'kpi' ? (
          <div className="h-10 w-28 animate-pulse rounded bg-border/60 motion-reduce:animate-none" />
        ) : variant === 'progress' ? (
          <>
            <div className="h-2 w-full animate-pulse rounded-pill bg-border/60 motion-reduce:animate-none" />
            <div className="h-6 w-20 animate-pulse rounded bg-border/60 motion-reduce:animate-none" />
          </>
        ) : (
          <>
            <div className="h-3 w-full animate-pulse rounded bg-border/60 motion-reduce:animate-none" />
            <div className="h-3 w-5/6 animate-pulse rounded bg-border/60 motion-reduce:animate-none" />
            <div className="h-3 w-4/6 animate-pulse rounded bg-border/60 motion-reduce:animate-none" />
          </>
        )}
      </div>
      <div className="mt-4 h-3 w-20 animate-pulse rounded bg-border/60 motion-reduce:animate-none" />
    </>
  )
}

type CardComponent = React.FC<CardProps> & {
  Header: typeof CardHeader
  Meta: typeof CardMeta
  Body: typeof CardBody
  Footer: typeof CardFooter
}

export const Card = CardRoot as CardComponent
Card.Header = CardHeader
Card.Meta = CardMeta
Card.Body = CardBody
Card.Footer = CardFooter
