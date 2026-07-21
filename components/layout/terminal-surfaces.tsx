import { clsx } from "clsx";
import type { PropsWithChildren, ReactNode } from "react";

type SurfaceProps = PropsWithChildren<{ className?: string }>;

export function OpenSection({ children, className }: SurfaceProps) {
  return <section className={clsx("open-section", className)}>{children}</section>;
}

export function SectionHeader({
  title,
  meta,
  actions,
  className,
}: {
  title: ReactNode;
  meta?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <header className={clsx("section-header", className)}>
      <div className="min-w-0">
        <span className="section-label">{title}</span>
        {meta && <span className="muted ml-2 text-xs">{meta}</span>}
      </div>
      {actions}
    </header>
  );
}

export function SegmentedRule({
  align = "start",
  className,
}: {
  align?: "start" | "center" | "end";
  className?: string;
}) {
  return (
    <div className={clsx("segmented-rule", className)} data-align={align} aria-hidden="true">
      <span />
      <span />
      <span />
    </div>
  );
}

export function DataGroup({ children, className }: SurfaceProps) {
  return <div className={clsx("data-group", className)}>{children}</div>;
}

export function EmphasisSurface({ children, className }: SurfaceProps) {
  return <section className={clsx("emphasis-surface", className)}>{children}</section>;
}

export function TableRegion({ children, className }: SurfaceProps) {
  return <div className={clsx("table-region", className)}>{children}</div>;
}
