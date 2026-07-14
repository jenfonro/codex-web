"use client";

import { memo, type ComponentProps } from "react";
import { cn } from "@/lib/utils";

type StaticTextBlockProps = Omit<ComponentProps<"pre">, "children"> & {
  text: unknown;
};

function StaticTextBlockImpl({
  text,
  className,
  ...props
}: StaticTextBlockProps) {
  const value = stringifyText(text);
  if (!value) return null;

  return (
    <pre
      data-slot="static-text-block"
      className={cn("aui-static-text-block whitespace-pre-wrap", className)}
      {...props}
    >
      {value}
    </pre>
  );
}

function stringifyText(value: unknown) {
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value, null, 2) ?? "";
  } catch {
    return String(value);
  }
}

export const StaticTextBlock = memo(StaticTextBlockImpl);
