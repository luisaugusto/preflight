/// <reference types="jest" />

import phakJson from "../../content/phak.json";
import { parseModuleContent } from "../content-sync";

describe("checked-in PHAK content", () => {
  it("satisfies the runtime content contract", () => {
    const module = parseModuleContent(phakJson);
    expect(module.id).toBe("phak");
    expect(module.sections.length).toBeGreaterThan(0);
    expect(module.sections.every((section) => section.lessons.length > 0)).toBe(true);
    expect(module.exam.length).toBeGreaterThan(0);
    expect(module.glossary.length).toBeGreaterThan(0);
  });
});

