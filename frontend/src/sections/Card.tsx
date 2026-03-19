import { ReactNode } from "react";
import clsx from "clsx";

interface CardProps {
  title?: string;
  subtitle?: string;
  rightSlot?: ReactNode; // % change, badge, icon
  children: ReactNode;
  className?: string;
}

export default function Card({
  title,
  subtitle,
  rightSlot,
  children,
  className,
}: CardProps) {
  return (
    <div
      className={clsx(
        "rounded-2xl border border-white/10 bg-[#0F172A]/80 backdrop-blur-xl",
        "shadow-lg hover:shadow-xl transition-all",
        "hover:border-white/20",
        className
      )}
    >
      {(title || rightSlot) && (
        <div className="flex items-center justify-between px-4 tablet:px-5 pt-3 tablet:pt-4">
          <div>
            {title && (
              <h3 className="text-sm font-semibold text-white">
                {title}
              </h3>
            )}
            {subtitle && (
              <p className="text-xs text-white/40 mt-0.5">
                {subtitle}
              </p>
            )}
          </div>

          {rightSlot && (
            <div className="text-xs text-white/60">
              {rightSlot}
            </div>
          )}
        </div>
      )}

      <div className="px-4 tablet:px-5 pb-4 tablet:pb-5 pt-2 tablet:pt-3">
        {children}
      </div>
    </div>
  );
}
