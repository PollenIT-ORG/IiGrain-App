import type { ModuleKey, ModuleRecord } from "../types";

/**
 * The six practice answers on the profile sheet, worked out from the records a
 * field actually holds. Derived in one place so the farm sheet and the field
 * sheet can never disagree.
 */
export interface PracticeRollup {
  tillage: string;
  organicAmendment: string;
  cropIntensification: string;
  cropDiversification: string;
  nutrientManagement: string;
  animalIntegration: string;
}

export type RecordsByModule = Partial<Record<ModuleKey, ModuleRecord[]>>;

/** A field with nothing recorded is left blank rather than marked as failing. */
const UNKNOWN = "";

const TILLAGE_NO_TILL = ["no till", "strip till", "no-till", "strip-till"];

/** The worksheet's own bar: 40% residue still covering the soil at planting. */
const RESIDUE_MIN = 40;

function num(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isNaN(n) ? null : n;
}

function tillageResult(records: ModuleRecord[]): string {
  if (!records.length) return UNKNOWN;

  const types = records.map((r) => String(r.tillage_type ?? "").toLowerCase());
  if (types.every((t) => TILLAGE_NO_TILL.includes(t))) return "No Till";

  // The list arrives newest first, so the first row is the latest event.
  const residue = num(records[0].residue_before_pct);
  if (residue !== null && residue >= RESIDUE_MIN) return "Reduced Till";

  return "Did Not Meet Requirement";
}

function yesIfAny(records: ModuleRecord[]): string {
  return records.length ? "Yes" : UNKNOWN;
}

function yesIf(records: ModuleRecord[], test: (r: ModuleRecord) => boolean): string {
  if (!records.length) return UNKNOWN;
  return records.some(test) ? "Yes" : "No";
}

export function practiceRollup(records: RecordsByModule): PracticeRollup {
  const at = (key: ModuleKey) => records[key] ?? [];
  return {
    tillage: tillageResult(at("tillage")),
    organicAmendment: yesIfAny(at("amendment")),
    cropIntensification: yesIf(at("crop_intensification"), (r) => r.in_use === true),
    cropDiversification: yesIf(at("crop"), (r) =>
      ["cover", "forage"].includes(String(r.crop_type ?? "").toLowerCase())
    ),
    nutrientManagement: yesIfAny(at("nutrient")),
    animalIntegration: yesIfAny(at("animal_integration")),
  };
}

/** The rollup as the six profile cells, in the order the sheet lists them. */
export function practiceCells(rollup: PracticeRollup): string[] {
  return [
    rollup.tillage,
    rollup.organicAmendment,
    rollup.cropIntensification,
    rollup.cropDiversification,
    rollup.nutrientManagement,
    rollup.animalIntegration,
  ];
}
