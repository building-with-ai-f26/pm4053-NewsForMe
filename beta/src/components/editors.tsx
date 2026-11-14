import { useMemo, useState } from "react";
import { Check, ChevronsUpDown, Plus, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cleanDomain, formatHour } from "@/lib/domain";
import { cn } from "@/lib/utils";

export function SourceChips({
  sources,
  onChange,
  placeholder = "Add a source, like ft.com",
}: {
  sources: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
}) {
  const [value, setValue] = useState("");
  const add = () => {
    const d = cleanDomain(value);
    if (!d) { toast.error("That does not look like a website. Try something like bbc.com."); return; }
    if (sources.includes(d)) { toast.error("That source is already on the list."); return; }
    onChange([...sources, d]);
    setValue("");
  };
  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {sources.length === 0 && <span className="text-sm text-muted-foreground">No sources yet.</span>}
        {sources.map((s) => (
          <span
            key={s}
            className="inline-flex items-center gap-1 rounded-full border border-border bg-secondary px-3 py-1 text-sm"
          >
            {s}
            <button
              type="button"
              aria-label={`Remove ${s}`}
              className="rounded-full p-0.5 text-muted-foreground hover:text-destructive"
              onClick={() => onChange(sources.filter((x) => x !== s))}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </span>
        ))}
      </div>
      <div className="mt-3 flex gap-2">
        <Input
          value={value}
          placeholder={placeholder}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
        />
        <Button type="button" variant="outline" onClick={add}>
          <Plus className="h-4 w-4" /> Add
        </Button>
      </div>
    </div>
  );
}

export function HourSelect({ value, onChange }: { value: number; onChange: (h: number) => void }) {
  return (
    <Select value={String(value)} onValueChange={(v) => onChange(Number(v))}>
      <SelectTrigger aria-label="Send time">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {Array.from({ length: 24 }, (_, h) => (
          <SelectItem key={h} value={String(h)}>
            {formatHour(h)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function TimezonePicker({ value, onChange }: { value: string; onChange: (tz: string) => void }) {
  const [open, setOpen] = useState(false);
  const zones = useMemo(() => {
    try {
      const list = (Intl as unknown as { supportedValuesOf: (k: string) => string[] }).supportedValuesOf(
        "timeZone",
      );
      return list.includes(value) ? list : [value, ...list];
    } catch {
      return [value, "America/New_York", "Europe/London", "Asia/Kolkata", "UTC"];
    }
  }, [value]);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" role="combobox" className="w-full justify-between font-normal">
          {value.replace(/_/g, " ")}
          <ChevronsUpDown className="h-4 w-4 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] min-w-72 p-0" align="start">
        <Command>
          <CommandInput placeholder="Search time zones" />
          <CommandList>
            <CommandEmpty>No time zone found.</CommandEmpty>
            {zones.map((z) => (
              <CommandItem
                key={z}
                value={z}
                onSelect={() => {
                  onChange(z);
                  setOpen(false);
                }}
              >
                <Check className={cn("h-4 w-4", z === value ? "opacity-100" : "opacity-0")} />
                {z.replace(/_/g, " ")}
              </CommandItem>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

export function SuggestionCard({
  name,
  description,
  selected,
  disabled,
  onToggle,
}: {
  name: string;
  description: string;
  selected: boolean;
  disabled?: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={selected}
      disabled={disabled && !selected}
      className={cn(
        "relative rounded-xl border bg-card p-4 text-left transition-all",
        selected ? "border-primary ring-2 ring-primary/30" : "border-border hover:border-foreground/40",
        disabled && !selected && "cursor-not-allowed opacity-50",
      )}
    >
      {selected && (
        <span className="absolute right-3 top-3 rounded-full bg-primary p-1 text-primary-foreground">
          <Check className="h-3 w-3" />
        </span>
      )}
      <div className="pr-6 text-lg font-bold tracking-tight">{name}</div>
      {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
    </button>
  );
}

export function LoadingNote({ text }: { text: string }) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-dashed border-border bg-muted/50 p-5 text-sm text-muted-foreground">
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      {text}
    </div>
  );
}
