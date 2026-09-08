// Server-safe form field primitives for the create forms (native <form> +
// server actions). No client JS.

import type { ReactNode } from "react";

const inputCls =
  "rounded-md border border-black/15 dark:border-white/20 bg-transparent px-3 py-2 outline-none focus:border-foreground text-sm";

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="font-medium">{label}</span>
      {children}
      {hint && <span className="text-xs text-black/50 dark:text-white/50">{hint}</span>}
    </label>
  );
}

export function TextInput(
  props: React.InputHTMLAttributes<HTMLInputElement>,
) {
  return <input {...props} className={inputCls} />;
}

export function TextArea(
  props: React.TextareaHTMLAttributes<HTMLTextAreaElement>,
) {
  return <textarea {...props} rows={3} className={inputCls} />;
}

export function Select({
  name,
  options,
  defaultValue,
  required,
}: {
  name: string;
  options: { value: string; label: string }[];
  defaultValue?: string;
  required?: boolean;
}) {
  return (
    <select
      name={name}
      defaultValue={defaultValue ?? ""}
      required={required}
      className={inputCls}
    >
      {!required && <option value="">—</option>}
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

/** Multi-select rendered as a checkbox group (submits repeated form values). */
export function CheckboxGroup({
  name,
  options,
  selected,
}: {
  name: string;
  options: { value: string; label: string }[];
  selected?: string[];
}) {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm">
      {options.map((o) => (
        <label key={o.value} className="flex items-center gap-1.5">
          <input
            type="checkbox"
            name={name}
            value={o.value}
            defaultChecked={selected?.includes(o.value)}
          />
          {o.label}
        </label>
      ))}
    </div>
  );
}

export function SubmitButton({ children }: { children: ReactNode }) {
  return (
    <button
      type="submit"
      className="mt-2 rounded-full bg-foreground text-background px-6 py-2.5 font-medium hover:opacity-90 transition w-fit"
    >
      {children}
    </button>
  );
}
