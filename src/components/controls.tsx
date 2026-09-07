"use client";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Language } from "../types/skill";
export function Pick({
  value,
  onChange,
  items,
  label,
}: {
  value: string;
  onChange: (v: string) => void;
  items: (string | { value: string; label: string })[];
  label: string;
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger aria-label={label}>
        <SelectValue placeholder={label} />
      </SelectTrigger>
      <SelectContent>
        {items.map((i) => {
          const v = typeof i === "string" ? i : i.value;
          return (
            <SelectItem key={v} value={v}>
              {typeof i === "string" ? i : i.label}
            </SelectItem>
          );
        })}
      </SelectContent>
    </Select>
  );
}
export function words(lang: Language) {
  return (zh: string, en: string) => (lang === "zh" ? zh : en);
}
export function download(
  name: string,
  data: string | Uint8Array,
  type = "text/plain",
) {
  const blob = new Blob(
    [typeof data === "string" ? data : new Uint8Array(data)],
    { type },
  );
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
