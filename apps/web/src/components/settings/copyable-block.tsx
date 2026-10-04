import { Check, Copy } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { copyToClipboard } from "@/lib/copy-to-clipboard";

type CopyableBlockProps = {
  value: string;
  label: string;
  labelHint?: string;
  copyLabel: string;
  copiedLabel: string;
};

export function CopyableBlock({
  value,
  label,
  labelHint,
  copyLabel,
  copiedLabel,
}: CopyableBlockProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    const copiedOk = await copyToClipboard(value);
    if (copiedOk) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium">
          {label}
          {labelHint && (
            <span className="ml-1.5 font-normal text-muted-foreground">
              {labelHint}
            </span>
          )}
        </p>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 gap-1.5 text-xs"
          onClick={handleCopy}
        >
          {copied ? (
            <>
              <Check className="size-3 text-success-foreground" />
              {copiedLabel}
            </>
          ) : (
            <>
              <Copy className="size-3" />
              {copyLabel}
            </>
          )}
        </Button>
      </div>
      <div className="max-h-40 overflow-y-auto rounded-sm border border-border bg-sidebar p-2.5">
        <code className="block break-all font-mono text-xs leading-relaxed whitespace-pre-wrap text-foreground">
          {value}
        </code>
      </div>
    </div>
  );
}
