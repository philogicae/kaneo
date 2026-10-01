import { Search, X } from "lucide-react";
import type { RefObject } from "react";
import { useTranslation } from "react-i18next";

type TaskSearchInputProps = {
  value: string;
  onChange: (value: string) => void;
  inputRef?: RefObject<HTMLInputElement | null>;
  placeholder?: string;
  className?: string;
};

export default function TaskSearchInput({
  value,
  onChange,
  inputRef,
  placeholder,
  className = "w-44 md:w-56",
}: TaskSearchInputProps) {
  const { t } = useTranslation();

  return (
    <div
      className={`relative inline-flex h-7 items-center rounded-md border border-border bg-background shadow-xs transition-[width,border-color,box-shadow] focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/50 ${className}`}
    >
      <Search
        aria-hidden="true"
        className="pointer-events-none absolute top-1/2 left-2 h-3 w-3 -translate-y-1/2 text-muted-foreground"
      />
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.stopPropagation();
            if (value) {
              onChange("");
            } else {
              event.currentTarget.blur();
            }
          }
        }}
        placeholder={placeholder ?? t("tasks:boardSearchPlaceholder")}
        aria-label={t("tasks:boardSearchPlaceholder")}
        className="h-7 w-full bg-transparent pr-6 pl-7 text-xs text-foreground outline-none placeholder:text-muted-foreground/70"
      />
      {value && (
        <button
          type="button"
          aria-label={t("common:actions.clearAll")}
          title={t("common:actions.clearAll")}
          onClick={() => onChange("")}
          className="absolute top-1/2 right-1 flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground/70 hover:bg-accent/60 hover:text-foreground"
        >
          <X className="h-3 w-3" />
        </button>
      )}
    </div>
  );
}
