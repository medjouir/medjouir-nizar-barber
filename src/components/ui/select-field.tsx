import type { SelectHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

type Props = SelectHTMLAttributes<HTMLSelectElement> & {
  label: string;
  options: { value: string | number; label: string }[];
};

/** Native select (best on mobile), styled like Field. */
export function SelectField({ label, options, id, name, className, ...props }: Props) {
  const selectId = id ?? name;
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={selectId} className="text-secondary text-muted">
        {label}
      </label>
      <select
        id={selectId}
        name={name}
        className={cn(
          "h-control w-full appearance-none rounded-card border border-line bg-surface px-4 text-body text-fg",
          "bg-[url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2214%22 height=%2214%22 viewBox=%220 0 24 24%22 fill=%22none%22 stroke=%22%239a9a9a%22 stroke-width=%222%22><path d=%22m6 9 6 6 6-6%22/></svg>')] bg-[length:14px] bg-[right_1rem_center] bg-no-repeat",
          "transition-colors duration-200 focus:border-gold focus:outline-none",
          className,
        )}
        {...props}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}
