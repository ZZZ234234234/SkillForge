import { z } from "zod";
import type { Skill, TestResult } from "../types/skill";
import { skillSchema } from "../features/skills/schema";
export interface Snapshot {
  skills: Skill[];
  results: TestResult[];
}
export interface SkillStorage {
  read(): Promise<Snapshot | null>;
  write(value: Snapshot): Promise<void>;
}
export class BrowserStorage implements SkillStorage {
  constructor(private key: string) {}
  async read() {
    const raw = localStorage.getItem(this.key);
    if (!raw) return null;
    const d = JSON.parse(raw);
    return {
      skills: d.skills.map((s: unknown) =>
        skillSchema
          .extend({
            name: z.string(),
            displayName: z.string(),
            description: z.string(),
            version: z.string(),
          })
          .parse(s),
      ),
      results: d.results ?? [],
    };
  }
  async write(value: Snapshot) {
    localStorage.setItem(this.key, JSON.stringify(value));
  }
}
// Interface permits an IndexedDB or filesystem adapter without UI changes.
