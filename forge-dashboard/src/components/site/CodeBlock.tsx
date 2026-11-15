"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";

/** Geist code block: raised surface, header strip with a filename/language label and a copy button. */
export function CodeBlock({ code, lang, filename }: { code: string; lang?: string; filename?: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable */
    }
  };
  return (
    <div className="my-6 overflow-hidden rounded-lg border border-gray-alpha-400 bg-background-200">
      <div className="flex h-10 items-center justify-between border-b border-gray-alpha-400 pl-4 pr-2">
        <span className="font-mono text-label-13 text-gray-900">{filename ?? lang ?? "text"}</span>
        <button
          type="button"
          onClick={copy}
          className="focus-ring inline-flex size-7 items-center justify-center rounded-md text-gray-900 transition-colors hover:bg-gray-alpha-200 hover:text-gray-1000"
          aria-label={copied ? "Copied" : "Copy code"}
        >
          {copied ? <Check className="size-3.5 text-green-700" aria-hidden /> : <Copy className="size-3.5" aria-hidden />}
        </button>
      </div>
      <pre className="scrollbar-thin overflow-x-auto px-4 py-3.5 font-mono text-label-13 leading-[22px] text-gray-1000">
        <code>{code}</code>
      </pre>
    </div>
  );
}
