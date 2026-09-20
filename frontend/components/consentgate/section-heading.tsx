import type { ReactNode } from "react";

export function SectionHeading({
  eyebrow,
  title,
  detail,
  action,
}: {
  eyebrow: string;
  title: string;
  detail?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-5 flex items-end justify-between gap-4">
      <div>
        <p className="mb-1 font-mono text-[10px] uppercase tracking-[0.18em] text-amber-200/65">
          {eyebrow}
        </p>
        <h2 className="font-mono text-base font-semibold tracking-tight text-stone-100">
          {title}
        </h2>
        {detail ? <p className="mt-1 text-xs text-stone-500">{detail}</p> : null}
      </div>
      {action}
    </div>
  );
}
