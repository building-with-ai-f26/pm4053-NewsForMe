import { describe, expect, it } from "vitest";
import { buildAbout, buildRole, missingFields, parseAbout, type Answers } from "./persona";

const student: Answers = {
  persona: "student",
  fields: {
    degree: "MBA", school: "NYU Stern", specializations: ["Strategy", "Tech"],
    goalFunction: ["Product"], goalIndustry: ["Technology"], goalGeo: ["United States"], interests: ["agentic commerce"],
  },
  extra: "",
};

describe("persona answers", () => {
  it("student prior experience and school are optional, everything else required", () => {
    expect(missingFields(student)).toEqual([]);
    expect(missingFields({ ...student, fields: { ...student.fields, school: "" } })).toEqual([]);
    expect(missingFields({ ...student, fields: { ...student.fields, degree: "" } })).toEqual(["Degree"]);
  });
  it("allows at most 3 industries", () => {
    const a: Answers = { persona: "professional", fields: { seniority: "Senior", industry: ["a", "b", "c", "d"], function: ["Product"], goals: "Lead" }, extra: "" };
    expect(missingFields(a)).toEqual(["Industry"]);
  });
  it("academia overview must be 20 to 500 characters", () => {
    const base: Answers = { persona: "academia", fields: { level: "Postdoc", field: "Biology", overview: "short" }, extra: "" };
    expect(missingFields(base)).toEqual(["Research in a few words"]);
    expect(missingFields({ ...base, fields: { ...base.fields, overview: "x".repeat(501) } })).toEqual(["Research in a few words"]);
    expect(missingFields({ ...base, fields: { ...base.fields, overview: "x".repeat(20) } })).toEqual([]);
  });
  it("extra details capped at 300 characters", () => {
    expect(missingFields({ ...student, extra: "x".repeat(301) })).toEqual(["Extra details"]);
  });
  it("round-trips through saved text and builds a role", () => {
    const a = { ...student, extra: "Love sports" };
    expect(parseAbout(buildAbout(a))).toEqual(a);
    expect(buildRole(a)).toBe("MBA student, NYU Stern");
  });
  it("treats old free text as not structured", () => {
    expect(parseAbout("I like news")).toBeNull();
  });
});
