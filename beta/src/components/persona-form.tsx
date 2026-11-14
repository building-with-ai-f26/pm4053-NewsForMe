import { useState } from "react";
import { Plus, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SuggestionCard } from "@/components/editors";
import { cn } from "@/lib/utils";
import { FIELDS, MAX_EXTRA, PERSONAS, buildAbout, buildRole, type Answers, type FieldDef } from "@/lib/persona";

export function PersonaForm({ value, onChange }: { value: Answers; onChange: (a: Answers) => void }) {
  const setField = (k: string, v: string | string[]) => onChange({ ...value, fields: { ...value.fields, [k]: v } });
  const summaryRole = buildRole(value);
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Label>Which describes you?</Label>
        <div className="grid gap-3 sm:grid-cols-3">
          {PERSONAS.map((p) => (
            <SuggestionCard
              key={p.id}
              name={p.label}
              description={p.description}
              selected={value.persona === p.id}
              onToggle={() => value.persona !== p.id && onChange({ persona: p.id, fields: {}, extra: value.extra })}
            />
          ))}
        </div>
      </div>

      {value.persona && (
        <>
          {FIELDS[value.persona].map((f) => (
            <FieldInput key={`${value.persona}-${f.key}`} def={f} value={value.fields[f.key]} onChange={(v) => setField(f.key, v)} />
          ))}
          <div className="space-y-2">
            <Label htmlFor="extra">Tell us more about yourself like interests, hobbies, and news outside your research you'd like to see (optional)</Label>
            <Textarea
              id="extra"
              rows={3}
              maxLength={MAX_EXTRA}
              value={value.extra}
              placeholder="For example: I follow cricket and want a weekly look at India startups."
              onChange={(e) => onChange({ ...value, extra: e.target.value })}
            />
            <div className="text-right text-xs text-muted-foreground">{value.extra.length} / {MAX_EXTRA}</div>
          </div>
          <div className="rounded-xl border border-border bg-muted/60 p-4 text-sm">
            <div className="font-semibold">Here is what we will use</div>
            {summaryRole && <p className="mt-1">{summaryRole}</p>}
            <pre className="mt-2 whitespace-pre-wrap font-sans text-muted-foreground">
              {buildAbout(value).split("\n").slice(2).join("\n") || "Fill in the questions above."}
            </pre>
          </div>
        </>
      )}
    </div>
  );
}

function FieldInput({ def, value, onChange }: { def: FieldDef; value: string | string[] | undefined; onChange: (v: string | string[]) => void }) {
  const label = `${def.label}${def.optional ? " (optional)" : ""}`;
  const id = `f-${def.key}`;
  if (def.kind === "text") {
    const v = typeof value === "string" ? value : "";
    return (
      <div className="space-y-2">
        <Label htmlFor={id}>{label}</Label>
        {(def.maxLen ?? 0) > 120 ? (
          <Textarea id={id} rows={4} maxLength={def.maxLen} value={v} placeholder={def.placeholder} onChange={(e) => onChange(e.target.value)} />
        ) : (
          <Input id={id} maxLength={def.maxLen} value={v} placeholder={def.placeholder} onChange={(e) => onChange(e.target.value)} />
        )}
        {def.minLen && (
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{def.hint}</span>
            <span>{v.trim().length} / {def.maxLen}</span>
          </div>
        )}
      </div>
    );
  }
  if (def.kind === "select") return <SingleSelect id={id} label={label} def={def} value={typeof value === "string" ? value : ""} onChange={onChange} />;
  return <MultiPick label={label} def={def} value={Array.isArray(value) ? value : []} onChange={onChange} />;
}

function SingleSelect({ id, label, def, value, onChange }: { id: string; label: string; def: FieldDef; value: string; onChange: (v: string) => void }) {
  const opts = def.options ?? [];
  const [other, setOther] = useState(!!value && !opts.includes(value));
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Select
        value={other ? "Other" : value}
        onValueChange={(v) => {
          if (v === "Other") { setOther(true); onChange(""); } else { setOther(false); onChange(v); }
        }}
      >
        <SelectTrigger id={id}><SelectValue placeholder="Choose one" /></SelectTrigger>
        <SelectContent>
          {opts.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
        </SelectContent>
      </Select>
      {other && <Input aria-label={`${def.label}, other`} maxLength={60} value={value} placeholder="Type yours" onChange={(e) => onChange(e.target.value)} />}
    </div>
  );
}

function MultiPick({ label, def, value, onChange }: { label: string; def: FieldDef; value: string[]; onChange: (v: string[]) => void }) {
  const [text, setText] = useState("");
  const max = def.max ?? 3;
  const opts = def.options ?? [];
  const custom = value.filter((v) => !opts.includes(v));
  const full = value.length >= max;
  const toggle = (o: string) => {
    if (value.includes(o)) return onChange(value.filter((x) => x !== o));
    if (full) return void toast.error(`You can pick up to ${max}.`);
    onChange([...value, o]);
  };
  const add = () => {
    const t = text.trim().slice(0, def.maxLen ?? 40);
    if (!t) return;
    if (value.some((v) => v.toLowerCase() === t.toLowerCase())) { toast.error("That is already on the list."); return; }
    if (full) { toast.error(`You can pick up to ${max}.`); return; }
    onChange([...value, t]);
    setText("");
  };
  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between gap-2">
        <Label>{label}</Label>
        <span className="text-xs text-muted-foreground">{value.length} of {max}</span>
      </div>
      <div className="flex flex-wrap gap-2">
        {opts.map((o) => {
          const on = value.includes(o);
          return (
            <button
              key={o}
              type="button"
              aria-pressed={on}
              onClick={() => toggle(o)}
              className={cn(
                "rounded-full border px-3 py-1 text-sm transition-colors",
                on ? "border-foreground bg-foreground font-semibold text-background" : "border-border bg-card hover:border-foreground/40",
              )}
            >
              {o}
            </button>
          );
        })}
        {custom.map((c) => (
          <span key={c} className="inline-flex items-center gap-1 rounded-full border border-foreground bg-foreground px-3 py-1 text-sm font-semibold text-background">
            {c}
            <button type="button" aria-label={`Remove ${c}`} onClick={() => onChange(value.filter((x) => x !== c))}>
              <X className="h-3.5 w-3.5" />
            </button>
          </span>
        ))}
      </div>
      <div className="flex gap-2">
        <Input
          aria-label={`${def.label}, add your own`}
          value={text}
          maxLength={def.maxLen ?? 40}
          disabled={full}
          placeholder={def.placeholder ?? (opts.length ? "Other: type your own" : "Type and press Enter")}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }}
        />
        <Button type="button" variant="outline" disabled={full} onClick={add}><Plus className="h-4 w-4" /> Add</Button>
      </div>
    </div>
  );
}
