import { Prisma } from "@prisma/client";
import prisma from "../db/prisma.js";

/**
 * Field monitoring modules.
 *
 * Nine modules, one table each, all the same shape: a record belongs to one
 * field, carries a status, and holds a handful of its own
 * columns. Rather than nine copies of the same CRUD, the table and the columns
 * each module owns are declared once in the registry below and the operations
 * are written once against that.
 *
 * The column list is not decoration. It is the whitelist: anything a caller
 * sends that is not on its module's list is dropped before it reaches the
 * database, so one module can never write into another's shape.
 */

export type ModuleKey =
  | "training"
  | "soil_samples"
  | "irrigation"
  | "pesticide"
  | "fertilizer"
  | "tillage"
  | "amendment"
  | "crop"
  | "nutrient"
  | "crop_intensification"
  | "animal_integration";

export type ModuleStatus = "in_progress" | "completed";

export interface ModuleRecord {
  id: string;
  field_id: string;
  status: ModuleStatus;
  notes: string | null;
  created_by: string | null;
  created_at: Date;
  updated_at: Date;
  [column: string]: unknown;
}

/**
 * Only the operations used here. The generated delegates differ per table, so
 * a narrow structural type lets one function serve all nine; the zod schema at
 * the route is what guarantees the shape of what goes in.
 */
interface Delegate {
  findMany(args: unknown): Promise<unknown[]>;
  findFirst(args: unknown): Promise<unknown>;
  create(args: unknown): Promise<unknown>;
  update(args: unknown): Promise<unknown>;
}

interface ModuleDef {
  /** The physical table, used for the counts query and error messages. */
  table: string;
  delegate: () => Delegate;
  /** Columns this module owns, beyond the shared ones. */
  columns: readonly string[];
  /** Of those, the ones that must be turned into a Date before saving. */
  dates: readonly string[];
  /** Of those, the ones the database stores as a boolean. */
  booleans: readonly string[];
  /** What the list is sorted by, newest first, falling back to created_at. */
  sortBy: string;
}

const MODULES: Record<ModuleKey, ModuleDef> = {
  training: {
    table: "field_trainings",
    delegate: () => prisma.field_trainings as unknown as Delegate,
    columns: ["training_date", "topic", "organizer", "hours"],
    dates: ["training_date"],
    booleans: [],
    sortBy: "training_date",
  },
  soil_samples: {
    table: "field_soil_samples",
    delegate: () => prisma.field_soil_samples as unknown as Delegate,
    columns: [
      "point_label", "latitude", "longitude", "sample_date",
      "soc_0_2", "soc_2_6", "was_0_2", "soil_texture", "soil_series",
    ],
    dates: ["sample_date"],
    booleans: [],
    sortBy: "point_label",
  },
  irrigation: {
    table: "field_irrigations",
    delegate: () => prisma.field_irrigations as unknown as Delegate,
    columns: [
      "irrigation_date", "irrigation_type", "amount_inches",
      "amount_gallons_ac", "source",
    ],
    dates: ["irrigation_date"],
    booleans: [],
    sortBy: "irrigation_date",
  },
  pesticide: {
    table: "field_pesticides",
    delegate: () => prisma.field_pesticides as unknown as Delegate,
    columns: [
      "application_date", "product", "product_type", "rate", "rate_unit",
      "application_method",
    ],
    dates: ["application_date"],
    booleans: [],
    sortBy: "application_date",
  },
  fertilizer: {
    table: "field_fertilizers",
    delegate: () => prisma.field_fertilizers as unknown as Delegate,
    columns: [
      "application_date", "fertilizer_type", "form", "application_method",
      "rate_lbs_acre", "n_pct", "p2o5_pct", "k2o_pct",
    ],
    dates: ["application_date"],
    booleans: [],
    sortBy: "application_date",
  },
  tillage: {
    table: "field_tillage_records",
    delegate: () => prisma.field_tillage_records as unknown as Delegate,
    columns: [
      "tillage_date", "implement", "tillage_type", "depth_inches",
      "residue_after_pct", "residue_before_pct", "soil_moisture",
    ],
    dates: ["tillage_date"],
    booleans: [],
    sortBy: "tillage_date",
  },
  amendment: {
    table: "field_amendments",
    delegate: () => prisma.field_amendments as unknown as Delegate,
    columns: [
      "application_date", "amendment_type", "source", "rate", "rate_unit",
      "n_pct", "p2o5_pct", "k2o_pct", "incorporated",
    ],
    dates: ["application_date"],
    booleans: ["incorporated"],
    sortBy: "application_date",
  },
  crop: {
    table: "field_crop_records",
    delegate: () => prisma.field_crop_records as unknown as Delegate,
    columns: [
      "crop_species", "crop_type", "planting_date", "harvest_date",
      "seeding_rate", "seeding_rate_unit", "yield_value", "yield_unit",
    ],
    dates: ["planting_date", "harvest_date"],
    booleans: [],
    sortBy: "planting_date",
  },
  nutrient: {
    table: "field_nutrient_events",
    delegate: () => prisma.field_nutrient_events as unknown as Delegate,
    columns: [
      "event_date", "variable_rate", "split_rate", "enhanced_efficiency",
      "application_method", "n_pct", "p2o5_pct", "k2o_pct", "rate_lbs_acre",
    ],
    dates: ["event_date"],
    booleans: ["variable_rate", "split_rate", "enhanced_efficiency"],
    sortBy: "event_date",
  },
  crop_intensification: {
    table: "field_crop_intensifications",
    delegate: () => prisma.field_crop_intensifications as unknown as Delegate,
    columns: [
      "event_date", "zone", "in_use", "crops_per_period", "period_years",
      "fallow_eliminated",
    ],
    dates: ["event_date"],
    booleans: ["in_use", "fallow_eliminated"],
    sortBy: "event_date",
  },
  animal_integration: {
    table: "field_animal_integrations",
    delegate: () => prisma.field_animal_integrations as unknown as Delegate,
    columns: [
      "event_date", "animal_breed", "grazing_period", "biomass_foraged_pct",
    ],
    dates: ["event_date"],
    booleans: [],
    sortBy: "event_date",
  },
};

export const MODULE_KEYS = Object.keys(MODULES) as ModuleKey[];

/** The columns a module owns, so a caller can be told an empty row is empty. */
export const MODULE_COLUMNS: Record<ModuleKey, readonly string[]> =
  Object.fromEntries(
    MODULE_KEYS.map((key) => [key, MODULES[key].columns])
  ) as Record<ModuleKey, readonly string[]>;

export function isModuleKey(value: string): value is ModuleKey {
  return Object.prototype.hasOwnProperty.call(MODULES, value);
}

/** A date-only column wants a Date; the API speaks YYYY-MM-DD. */
function toDate(value: unknown): Date | null {
  if (value === null || value === undefined || value === "") return null;
  const d = new Date(`${String(value).slice(0, 10)}T00:00:00.000Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Keeps only the columns this module owns, and converts each to what the
 * column actually stores. Anything else the caller sent is ignored.
 */
function shapeData(
  key: ModuleKey,
  input: Record<string, unknown>
): Record<string, unknown> {
  const def = MODULES[key];
  const out: Record<string, unknown> = {};

  for (const col of def.columns) {
    if (!(col in input)) continue;
    const raw = input[col];
    if (def.dates.includes(col)) out[col] = toDate(raw);
    else if (def.booleans.includes(col)) out[col] = raw === null ? null : Boolean(raw);
    else out[col] = raw === "" ? null : raw;
  }

  if ("status" in input) out.status = input.status;
  if ("notes" in input) out.notes = input.notes === "" ? null : input.notes;
  return out;
}

export async function listRecords(
  key: ModuleKey,
  fieldId: string
): Promise<ModuleRecord[]> {
  const def = MODULES[key];
  const rows = await def.delegate().findMany({
    where: { field_id: fieldId, deleted_at: null },
    // Newest first by the date that matters to the module, and created_at
    // breaks the tie so rows with no date yet still sit in a stable order.
    orderBy: [{ [def.sortBy]: "desc" }, { created_at: "desc" }],
  });
  return rows as ModuleRecord[];
}

export async function findRecord(
  key: ModuleKey,
  id: string
): Promise<ModuleRecord | null> {
  const row = await MODULES[key].delegate().findFirst({
    where: { id, deleted_at: null },
  });
  return (row as ModuleRecord) ?? null;
}

export async function createRecord(
  key: ModuleKey,
  input: {
    fieldId: string;
    createdBy: string | null;
    data: Record<string, unknown>;
  }
): Promise<ModuleRecord> {
  const row = await MODULES[key].delegate().create({
    data: {
      field_id: input.fieldId,
      created_by: input.createdBy,
      ...shapeData(key, input.data),
    },
  });
  return row as ModuleRecord;
}

export async function updateRecord(
  key: ModuleKey,
  id: string,
  data: Record<string, unknown>
): Promise<ModuleRecord> {
  const row = await MODULES[key].delegate().update({
    where: { id },
    data: { ...shapeData(key, data), updated_at: new Date() },
  });
  return row as ModuleRecord;
}

export async function softDeleteRecord(
  key: ModuleKey,
  id: string
): Promise<void> {
  await MODULES[key].delegate().update({
    where: { id },
    data: { deleted_at: new Date(), updated_at: new Date() },
  });
}

export interface FarmModuleRecord extends ModuleRecord {
  field_name: string;
}

/** One module across every field of a farm, with the field name on each row. */
export async function listFarmRecords(
  key: ModuleKey,
  farmId: string
): Promise<FarmModuleRecord[]> {
  const def = MODULES[key];
  return prisma.$queryRaw<FarmModuleRecord[]>(Prisma.sql`
    SELECT m.*, f.name AS field_name
      FROM ${Prisma.raw(def.table)} m
      JOIN fields f ON f.id = m.field_id AND f.deleted_at IS NULL
     WHERE f.farm_id = ${farmId}::uuid
       AND m.deleted_at IS NULL
     ORDER BY f.name ASC, m.created_at DESC`);
}

/** The same counts as a field's module list, but for the whole farm. */
export async function farmModuleCounts(farmId: string): Promise<ModuleCount[]> {
  const parts = MODULE_KEYS.map(
    (key) => Prisma.sql`
      SELECT ${key}::text AS module,
             COUNT(*)::int AS total,
             COUNT(*) FILTER (WHERE m.status = 'completed')::int AS completed
        FROM ${Prisma.raw(MODULES[key].table)} m
        JOIN fields f ON f.id = m.field_id AND f.deleted_at IS NULL
       WHERE f.farm_id = ${farmId}::uuid
         AND m.deleted_at IS NULL`
  );

  const rows = await prisma.$queryRaw<
    Array<{ module: ModuleKey; total: number; completed: number }>
  >(Prisma.join(parts, " UNION ALL "));

  const byKey = new Map(rows.map((r) => [r.module, r]));
  return MODULE_KEYS.map((key) => ({
    module: key,
    total: byKey.get(key)?.total ?? 0,
    completed: byKey.get(key)?.completed ?? 0,
  }));
}

/** The date each module is filed under, for grouping records into years. */
const YEAR_COLUMN: Record<ModuleKey, string> = {
  training: "training_date",
  soil_samples: "sample_date",
  irrigation: "irrigation_date",
  pesticide: "application_date",
  fertilizer: "application_date",
  tillage: "tillage_date",
  amendment: "application_date",
  crop: "planting_date",
  nutrient: "event_date",
  crop_intensification: "event_date",
  animal_integration: "event_date",
};

/** Every year a farm has monitoring records in, newest first. */
export async function farmYears(farmId: string): Promise<string[]> {
  const parts = MODULE_KEYS.map(
    (key) => Prisma.sql`
      SELECT to_char(COALESCE(m.${Prisma.raw(YEAR_COLUMN[key])}, m.created_at), 'YYYY') AS yr
        FROM ${Prisma.raw(MODULES[key].table)} m
        JOIN fields f ON f.id = m.field_id AND f.deleted_at IS NULL
       WHERE f.farm_id = ${farmId}::uuid AND m.deleted_at IS NULL`
  );
  const rows = await prisma.$queryRaw<Array<{ yr: string }>>(
    Prisma.sql`SELECT DISTINCT yr FROM (${Prisma.join(parts, " UNION ALL ")}) y
                WHERE yr IS NOT NULL ORDER BY yr DESC`
  );
  return rows.map((r) => r.yr);
}

/** One field of a farm, as the workbook lists it. */
export interface FarmField {
  fieldId: string;
  fieldName: string;
  areaAcres: number | null;
}

/** Every live field of a farm, for the farm-wide monitoring screens. */
export async function fieldsForFarm(farmId: string): Promise<FarmField[]> {
  const rows = await prisma.fields.findMany({
    where: { farm_id: farmId, deleted_at: null },
    select: { id: true, name: true, area_acres: true },
    orderBy: { name: "asc" },
  });
  return rows.map((r) => ({
    fieldId: r.id,
    fieldName: r.name,
    areaAcres: r.area_acres === null ? null : Number(r.area_acres),
  }));
}

export interface ModuleCount {
  module: ModuleKey;
  total: number;
  completed: number;
}

/**
 * What the module list on the app shows, the "1 / 3 completed" line. One query
 * across all nine tables rather than nine round trips, because this runs every
 * time a farmer opens a field.
 */
export async function moduleCounts(fieldId: string): Promise<ModuleCount[]> {
  const parts = MODULE_KEYS.map(
    (key) => Prisma.sql`
      SELECT ${key}::text AS module,
             COUNT(*)::int AS total,
             COUNT(*) FILTER (WHERE status = 'completed')::int AS completed
        FROM ${Prisma.raw(MODULES[key].table)}
       WHERE field_id = ${fieldId}::uuid
         AND deleted_at IS NULL`
  );

  const rows = await prisma.$queryRaw<
    Array<{ module: ModuleKey; total: number; completed: number }>
  >(Prisma.join(parts, " UNION ALL "));

  // Every module is returned, including the ones with nothing in them yet, so
  // the app can render the full list without filling gaps itself.
  const byKey = new Map(rows.map((r) => [r.module, r]));
  return MODULE_KEYS.map((key) => ({
    module: key,
    total: byKey.get(key)?.total ?? 0,
    completed: byKey.get(key)?.completed ?? 0,
  }));
}
