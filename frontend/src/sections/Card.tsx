import { ReactNode } from "react";
import clsx from "clsx";

interface CardProps {
  title?: string;
  subtitle?: string;
  rightSlot?: ReactNode;
  children: ReactNode;
  className?: string;
  /** Merged onto the inner content wrapper. Use p-0 for chart canvases. */
  bodyClassName?: string;
}

export default function Card({
  title,
  subtitle,
  rightSlot,
  children,
  className,
  bodyClassName,
}: CardProps) {
  return (
    <section
      className={clsx(
        "overflow-hidden rounded-[var(--dsa-radius-md)] border border-[var(--dsa-border)] bg-[var(--dsa-surface-1)]",
        className
      )}
    >
      {(title || rightSlot) && (
        <div className="flex items-center justify-between gap-3 border-b border-[var(--dsa-border)] px-3 py-2 tablet:px-4">
          <div className="min-w-0">
            {title ? <h3 className="text-xs font-semibold text-white">{title}</h3> : null}
            {subtitle ? (
              <p className="mt-0.5 truncate text-[10px] text-[var(--dsa-text-muted)]">{subtitle}</p>
            ) : null}
          </div>

          {rightSlot ? <div className="shrink-0 text-xs text-[var(--dsa-text-secondary)]">{rightSlot}</div> : null}
        </div>
      )}

      <div
        className={clsx(
          "px-3 pb-3 pt-2 tablet:px-4 tablet:pb-4 tablet:pt-3",
          bodyClassName
        )}
      >
        {children}
      </div>
    </section>
  );
}
