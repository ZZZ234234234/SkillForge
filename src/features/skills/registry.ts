import data from "../../../registry/registry.json";
import { skillSchema } from "./schema";
export function registrySkills() {
  return data.map((s) => skillSchema.parse(s));
}
export const categories = [
  "Coding",
  "GitHub",
  "Research",
  "Writing",
  "Data",
  "DevOps",
  "Frontend",
  "Backend",
  "Testing",
  "Documentation",
  "Productivity",
  "Education",
];
