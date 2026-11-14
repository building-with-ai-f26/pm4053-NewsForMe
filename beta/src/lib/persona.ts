export type Persona = "student" | "professional" | "academia";
export type FieldKind = "select" | "multi" | "tags" | "text";
export type FieldDef = {
  key: string;
  label: string;
  kind: FieldKind;
  options?: string[];
  max?: number;
  minLen?: number;
  maxLen?: number;
  optional?: boolean;
  placeholder?: string;
  hint?: string;
};
export type Answers = {
  persona: Persona | null;
  fields: Record<string, string | string[]>;
  extra: string;
};

export const MARKER = "NewsForMe profile v1";
export const MAX_EXTRA = 300;
export const MAX_PICKS = 3;

export const PERSONAS: { id: Persona; label: string; description: string }[] = [
  { id: "student", label: "Student", description: "Studying for a degree right now." },
  { id: "professional", label: "Working professional", description: "Working in a job or running a business." },
  { id: "academia", label: "Academia", description: "Professor, PhD student, postdoc or researcher." },
];

export const INDUSTRIES = [
  "Technology", "Financial services", "Consulting", "Healthcare", "Pharma and biotech", "Energy",
  "Consumer goods", "Retail and e-commerce", "Media and entertainment", "Manufacturing",
  "Automotive and mobility", "Real estate", "Government and policy", "Education", "Nonprofit", "Telecom",
];
export const FUNCTIONS = [
  "Product", "Engineering", "Data and AI", "Strategy", "Finance", "Investing", "Marketing", "Sales",
  "Operations", "Consulting", "Design", "Research", "Legal", "HR", "General management", "Entrepreneurship",
];
export const GEOGRAPHIES = [
  "United States", "Canada", "Latin America", "United Kingdom", "Europe", "Middle East", "Africa",
  "India", "China", "Japan", "Southeast Asia", "Australia and NZ", "Global",
];

const DEGREES = ["MBA", "MS", "MA", "BS or BA", "MD", "JD", "Other"];
const SENIORITY = ["Entry level", "Mid level", "Senior", "Lead or Manager", "Director", "VP", "C-level or Founder"];
const ACADEMIC_LEVELS = [
  "PhD student", "Postdoc", "Assistant Professor", "Associate Professor", "Full Professor", "Researcher", "Other",
];

export const FIELDS: Record<Persona, FieldDef[]> = {
  student: [
    { key: "degree", label: "Degree", kind: "select", options: DEGREES },
    { key: "school", label: "School", kind: "text", maxLen: 80, optional: true, placeholder: "For example: NYU Stern" },
    { key: "specializations", label: "Specializations", kind: "tags", max: MAX_PICKS, maxLen: 120, placeholder: "For example: Strategy" },
    { key: "priorFunction", label: "Prior experience: function", kind: "multi", options: FUNCTIONS, max: MAX_PICKS, optional: true },
    { key: "priorIndustry", label: "Prior experience: industry", kind: "multi", options: INDUSTRIES, max: MAX_PICKS, optional: true },
    { key: "priorGeo", label: "Where you worked before", kind: "multi", options: GEOGRAPHIES, max: MAX_PICKS, optional: true },
    { key: "goalFunction", label: "Goal after your degree: function", kind: "multi", options: FUNCTIONS, max: MAX_PICKS },
    { key: "goalIndustry", label: "Goal after your degree: industry", kind: "multi", options: INDUSTRIES, max: MAX_PICKS },
    { key: "goalGeo", label: "Where you want to work", kind: "multi", options: GEOGRAPHIES, max: MAX_PICKS },
    { key: "interests", label: "Niche interests", kind: "tags", max: 5, maxLen: 40, placeholder: "For example: agentic commerce" },
  ],
  professional: [
    { key: "seniority", label: "Seniority", kind: "select", options: SENIORITY },
    { key: "industry", label: "Industry", kind: "multi", options: INDUSTRIES, max: MAX_PICKS },
    { key: "function", label: "Function", kind: "multi", options: FUNCTIONS, max: MAX_PICKS },
    { key: "goals", label: "Future goals", kind: "text", maxLen: 150, placeholder: "For example: move into AI product leadership" },
  ],
  academia: [
    { key: "level", label: "Level", kind: "select", options: ACADEMIC_LEVELS },
    { key: "field", label: "Field of research", kind: "text", maxLen: 80, placeholder: "For example: Computational biology" },
    { key: "overview", label: "Research in a few words", kind: "text", minLen: 20, maxLen: 500, placeholder: "For example: protein folding with deep learning", hint: "20 to 500 characters." },
  ],
};

const PERSONA_LABEL: Record<Persona, string> = { student: "Student", professional: "Working professional", academia: "Academia" };

export const emptyAnswers = (): Answers => ({ persona: null, fields: {}, extra: "" });

const asList = (v: string | string[] | undefined) => (Array.isArray(v) ? v : v ? [v] : []).map((s) => s.trim()).filter(Boolean);
const asText = (v: string | string[] | undefined) => (Array.isArray(v) ? v.join(", ") : v ?? "").trim();
const clean = (s: string) => s.replace(/[;\n\r]+/g, ",").trim();

/** Labels of required fields that are missing or invalid. Empty list means complete. */
export function missingFields(a: Answers): string[] {
  if (!a.persona) return ["Which describes you"];
  const out: string[] = [];
  for (const f of FIELDS[a.persona]) {
    const v = a.fields[f.key];
    if (f.kind === "multi" || f.kind === "tags") {
      const n = asList(v).length;
      if ((!f.optional && n === 0) || (f.max && n > f.max)) out.push(f.label);
    } else {
      const t = asText(v);
      if (!f.optional && !t) out.push(f.label);
      else if (t && ((f.minLen && t.length < f.minLen) || (f.maxLen && t.length > f.maxLen))) out.push(f.label);
    }
  }
  if (a.extra.trim().length > MAX_EXTRA) out.push("Extra details");
  return out;
}

export function buildRole(a: Answers): string {
  const f = a.fields;
  let r = "";
  if (a.persona === "student") r = `${asText(f["degree"])} student${asText(f["school"]) ? `, ${asText(f["school"])}` : ""}`;
  if (a.persona === "professional") r = `${asText(f["seniority"])} ${asList(f["function"])[0] ?? ""}, ${asList(f["industry"])[0] ?? ""}`;
  if (a.persona === "academia") r = `${asText(f["level"])}, ${asText(f["field"])}`;
  return r.replace(/\s+/g, " ").replace(/,\s*$/, "").trim().slice(0, 100);
}

export function buildAbout(a: Answers): string {
  if (!a.persona) return "";
  const lines = [MARKER, `Persona: ${PERSONA_LABEL[a.persona]}`];
  for (const f of FIELDS[a.persona]) {
    const vals = asList(a.fields[f.key]).map(clean);
    if (vals.length) lines.push(`${f.label}: ${vals.join("; ")}`);
  }
  const extra = clean(a.extra).slice(0, MAX_EXTRA);
  if (extra) lines.push(`Extra details: ${extra}`);
  return lines.join("\n").slice(0, 1000);
}

/** Read answers back from saved text. Returns null for older free-text profiles. */
export function parseAbout(about: string | null | undefined): Answers | null {
  const lines = (about ?? "").split("\n");
  if (lines[0]?.trim() !== MARKER) return null;
  const rest = lines.slice(1);
  const get = (label: string) => rest.find((l) => l.startsWith(label + ": "))?.slice(label.length + 2);
  const map = { get };
  const persona = (Object.keys(PERSONA_LABEL) as Persona[]).find((p) => PERSONA_LABEL[p] === map.get("Persona")) ?? null;
  if (!persona) return null;
  const fields: Answers["fields"] = {};
  for (const f of FIELDS[persona]) {
    const raw = map.get(f.label);
    if (raw === undefined) continue;
    fields[f.key] = f.kind === "multi" || f.kind === "tags" ? raw.split("; ").filter(Boolean) : raw;
  }
  return { persona, fields, extra: map.get("Extra details") ?? "" };
}
