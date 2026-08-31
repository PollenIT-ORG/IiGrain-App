import type { ModuleKey } from "../types";

/**
 * One description of every monitoring module, used by three places at once:
 * the table on screen, the add and edit form, and the Excel export.
 *
 * Nine modules carry about sixty columns between them. Written out per screen
 * that would be three copies of the same list, and a column added later would
 * have to be remembered in all three. Declared once here, adding a column is a
 * single line and it appears everywhere.
 *
 * Every limit below matches the backend rule exactly. They are not a second
 * opinion; the server still refuses anything wrong. These are here so the user
 * finds out while typing rather than after pressing Save.
 */

export type FieldType =
  | "text"
  | "number"
  | "date"
  | "select"
  | "boolean"
  | "textarea";

export interface ModuleField {
  /** The column name, exactly as the API expects it. */
  key: string;
  label: string;
  type: FieldType;
  /** Shown in the table. Some fields are form-only, to keep tables readable. */
  inTable?: boolean;
  required?: boolean;
  maxLength?: number;
  min?: number;
  max?: number;
  /** Decimal places allowed, matching the column in the database. */
  step?: string;
  options?: readonly string[];
  placeholder?: string;
  /** A hint under the input, for anything a farmer might read differently. */
  hint?: string;
  /** Excel column width, in characters. */
  width?: number;
}

export interface ModuleDef {
  key: ModuleKey;
  label: string;
  /** What one row is called, used in buttons and confirmations. */
  singular: string;
  /** The Excel sheet name. Excel caps these at 31 characters. */
  sheetName: string;
  fields: readonly ModuleField[];
}

/** Offered everywhere a farmer picks how something was put on the field. */
const APPLICATION_METHODS = [
  "Broadcast",
  "Banded",
  "In-furrow",
  "Foliar",
  "Spray rig",
  "Injected",
  "Ground",
  "Aerial",
  "Other",
] as const;

const RATE_UNITS = [
  "lbs / acre",
  "tons / acre",
  "gal / acre",
  "qt / acre",
  "pt / acre",
  "oz / acre",
  "kg / acre",
] as const;

const YIELD_UNITS = [
  "bu / acre",
  "lbs / acre",
  "tons / acre",
  "cwt / acre",
] as const;

export const MODULES: readonly ModuleDef[] = [
  {
    key: "training",
    label: "Training",
    singular: "Training Record",
    sheetName: "Training",
    fields: [
      { key: "training_date", label: "Date", type: "date", inTable: true, width: 14 },
      { key: "topic", label: "Name of Training", type: "text", inTable: true, maxLength: 200, width: 30 },
      { key: "organizer", label: "Training Organizer/Host/Sponsor", type: "text", inTable: true, maxLength: 200, width: 24 },
      { key: "hours", label: "Length of Training (hrs)", type: "number", inTable: true, min: 0, max: 999, step: "0.01", width: 10 },
    ],
  },
  {
    key: "soil_samples",
    label: "Soil Samples",
    singular: "Sample Record",
    sheetName: "Soil Sample Results",
    fields: [
      { key: "point_label", label: "GPS Point", type: "text", inTable: true, required: true, maxLength: 60, placeholder: "Point 1", width: 14 },
      { key: "sample_date", label: "Soil Sample Date (MM/DD/YYYY)", type: "date", inTable: true, width: 14 },
      { key: "latitude", label: "Latitude", type: "number", inTable: true, min: -90, max: 90, step: "0.000001", placeholder: "41.523123", width: 14 },
      { key: "longitude", label: "Longitude", type: "number", inTable: true, min: -180, max: 180, step: "0.000001", placeholder: "-93.567890", width: 14 },
      { key: "soc_0_2", label: "SOC 0-2", type: "number", inTable: true, min: 0, max: 100, step: "0.001", width: 14 },
      { key: "soc_2_6", label: "SOC 2-6", type: "number", inTable: true, min: 0, max: 100, step: "0.001", width: 14 },
      { key: "was_0_2", label: "WAS 0-2", type: "number", inTable: true, min: 0, max: 100, step: "0.001", hint: "The average across the points is what the scorecard uses.", width: 14 },
      { key: "soil_texture", label: "Soil Texture", type: "text", inTable: true, maxLength: 100, placeholder: "Silt Loam", width: 18 },
      { key: "soil_series", label: "NRCS Soil Series", type: "text", maxLength: 150, placeholder: "Pullman", hint: "The named soil series from the soil survey, if known.", width: 18 },
    ],
  },
  {
    key: "irrigation",
    label: "Irrigation",
    singular: "Irrigation Record",
    sheetName: "Irrigation",
    fields: [
      { key: "irrigation_date", label: "Date of Irrigation Event (MM/DD/YYYY)", type: "date", inTable: true, width: 14 },
      { key: "irrigation_type", label: "Irrigation type", type: "select", inTable: true, maxLength: 100, options: ["Pivot", "Center Pivot Irrigation", "Drip Irrigation", "Furrow Irrigation", "Flood", "Sprinkler", "Other"], width: 20 },
      { key: "amount_inches", label: "Irrigation amount (inches)", type: "number", inTable: true, min: 0, max: 9999, step: "0.01", width: 15 },
      { key: "amount_gallons_ac", label: "Amount (gallons/acre)", type: "number", inTable: true, min: 0, max: 9999999, step: "0.01", width: 20 },
      { key: "source", label: "Source", type: "select", inTable: true, maxLength: 100, options: ["Well", "Surface water", "Canal", "Pond", "Municipal", "Other"], width: 14 },
    ],
  },
  {
    key: "pesticide",
    label: "Pesticide Use",
    singular: "Pesticide Application",
    sheetName: "Pesticide Use",
    fields: [
      { key: "application_date", label: "Date applied (MM/DD/YYYY)", type: "date", inTable: true, width: 18 },
      { key: "product", label: "Pesticide used", type: "text", inTable: true, maxLength: 200, placeholder: "Atrazine 4L", width: 24 },
      { key: "product_type", label: "Product Type", type: "select", inTable: true, maxLength: 100, options: ["Herbicide", "Insecticide", "Fungicide", "Nematicide", "Rodenticide", "Biological", "Other"], width: 16 },
      { key: "rate", label: "Pesticide rate", type: "number", inTable: true, min: 0, max: 999999, step: "0.001", width: 10 },
      { key: "rate_unit", label: "Rate Unit", type: "select", inTable: true, maxLength: 50, options: RATE_UNITS, width: 14 },
      { key: "application_method", label: "Application method", type: "select", inTable: true, maxLength: 100, options: APPLICATION_METHODS, width: 18 },
    ],
  },
  {
    key: "fertilizer",
    label: "Synthetic Fertilizer",
    singular: "Fertilizer Application",
    sheetName: "Synthetic Fertilizer",
    fields: [
      { key: "application_date", label: "Application Date", type: "date", inTable: true, width: 15 },
      { key: "fertilizer_type", label: "Fertilizer Type", type: "text", inTable: true, maxLength: 150, placeholder: "Urea (46-0-0)", width: 22 },
      { key: "form", label: "Form", type: "select", inTable: true, maxLength: 50, options: ["Granular", "Liquid", "Gas", "Slow release"], width: 14 },
      { key: "application_method", label: "Application Method", type: "select", inTable: true, maxLength: 100, options: APPLICATION_METHODS, width: 18 },
      { key: "rate_lbs_acre", label: "Bulk lbs/Acre", type: "number", inTable: true, min: 0, max: 999999, step: "0.01", width: 15 },
      { key: "n_pct", label: "N (%)", type: "number", inTable: true, min: 0, max: 100, step: "0.01", width: 10 },
      { key: "p2o5_pct", label: "P2O5 (%)", type: "number", inTable: true, min: 0, max: 100, step: "0.01", width: 10 },
      { key: "k2o_pct", label: "K2O (%)", type: "number", inTable: true, min: 0, max: 100, step: "0.01", width: 10 },
    ],
  },
  {
    key: "tillage",
    label: "Tillage",
    singular: "Tillage Record",
    sheetName: "Tillage",
    fields: [
      { key: "tillage_date", label: "Date of Tillage (MM/DD/YYYY)", type: "date", inTable: true, width: 14 },
      { key: "implement", label: "Tillage Implement Used", type: "text", inTable: true, maxLength: 150, placeholder: "Vertical Tillage", width: 20 },
      { key: "tillage_type", label: "Tillage Type", type: "select", inTable: true, maxLength: 100, options: ["No Till", "Strip Till", "Reduced Till", "Conservation Tillage", "Conventional Tillage", "Vertical Tillage"], width: 20 },
      { key: "depth_inches", label: "Tillage depth", type: "number", inTable: true, min: 0, max: 999, step: "0.01", width: 14 },
      { key: "residue_after_pct", label: "% of Crop Residue after tillage event", type: "number", inTable: true, min: 0, max: 100, step: "0.01", width: 16 },
      { key: "residue_before_pct", label: "% of Crop Residue before planting", type: "number", min: 0, max: 100, step: "0.01", hint: "The worksheet asks this stays at 40% or above.", width: 22 },
      { key: "soil_moisture", label: "Soil Moisture", type: "select", inTable: true, maxLength: 50, options: ["Dry", "Moderate", "Wet"], width: 14 },
    ],
  },
  {
    key: "amendment",
    label: "Organic Amendments",
    singular: "Amendment Record",
    sheetName: "Organic Amendments",
    fields: [
      { key: "application_date", label: "Application Date", type: "date", inTable: true, width: 15 },
      { key: "amendment_type", label: "Amendment Type", type: "select", inTable: true, maxLength: 150, options: ["Manure", "Compost", "Biochar", "Other"], width: 18 },
      { key: "source", label: "Source", type: "select", inTable: true, maxLength: 100, options: ["On-farm", "Purchased", "Other"], width: 14 },
      { key: "rate", label: "Bulk rate lbs/acre", type: "number", inTable: true, min: 0, max: 999999, step: "0.01", width: 15 },
      { key: "rate_unit", label: "Rate Unit", type: "select", inTable: true, maxLength: 50, options: RATE_UNITS, width: 14 },
      { key: "n_pct", label: "N (%)", type: "number", inTable: true, min: 0, max: 100, step: "0.01", width: 10 },
      { key: "p2o5_pct", label: "P2O5 (%)", type: "number", inTable: true, min: 0, max: 100, step: "0.01", width: 10 },
      { key: "k2o_pct", label: "K2O (%)", type: "number", inTable: true, min: 0, max: 100, step: "0.01", width: 10 },
      { key: "incorporated", label: "Incorporated", type: "boolean", inTable: true, width: 14 },
    ],
  },
  {
    key: "crop",
    label: "Crop Diversification",
    singular: "Crop Record",
    sheetName: "Crop Diversification",
    fields: [
      { key: "crop_species", label: "Crop Species", type: "text", inTable: true, maxLength: 150, placeholder: "Soybean", width: 18 },
      { key: "crop_type", label: "Crop Type (cash, cover, forage)", type: "select", inTable: true, options: ["cash", "cover", "forage"], hint: "The worksheet counts cash, cover and forage crops separately.", width: 14 },
      { key: "planting_date", label: "Plant Date", type: "date", inTable: true, width: 14 },
      { key: "harvest_date", label: "Harvest Date", type: "date", inTable: true, width: 14 },
      { key: "seeding_rate", label: "Seeding Rate", type: "number", inTable: true, min: 0, max: 999999, step: "0.01", width: 14 },
      { key: "seeding_rate_unit", label: "Rate Unit", type: "select", inTable: true, maxLength: 50, options: RATE_UNITS, width: 14 },
      { key: "yield_value", label: "Yield (if crop is harvested)", type: "number", inTable: true, min: 0, max: 9999999, step: "0.01", width: 12 },
      { key: "yield_unit", label: "Yield Unit", type: "select", inTable: true, maxLength: 50, options: YIELD_UNITS, width: 14 },
    ],
  },
  {
    key: "nutrient",
    label: "Nutrient Management",
    singular: "Nutrient Event",
    sheetName: "Nutrient Management",
    fields: [
      { key: "event_date", label: "Date of fertility event", type: "date", inTable: true, width: 18 },
      { key: "variable_rate", label: "Variable Rate (Y/N)", type: "boolean", inTable: true, width: 14 },
      { key: "split_rate", label: "Split-Rate Application (Y/N)", type: "boolean", inTable: true, width: 18 },
      { key: "enhanced_efficiency", label: "Enhanced-Efficiency Fertilizer (Y/N)", type: "boolean", inTable: true, width: 24 },
      { key: "application_method", label: "Application Method", type: "select", inTable: true, maxLength: 100, options: APPLICATION_METHODS, width: 18 },
      { key: "n_pct", label: "N (%)", type: "number", inTable: true, min: 0, max: 100, step: "0.01", width: 10 },
      { key: "p2o5_pct", label: "P2O5 (%)", type: "number", inTable: true, min: 0, max: 100, step: "0.01", width: 10 },
      { key: "k2o_pct", label: "K2O (%)", type: "number", inTable: true, min: 0, max: 100, step: "0.01", width: 10 },
      { key: "rate_lbs_acre", label: "Bulk (lbs/acre)", type: "number", inTable: true, min: 0, max: 999999, step: "0.01", width: 15 },
    ],
  },
  {
    key: "crop_intensification",
    label: "Crop Intensification",
    singular: "Intensification Record",
    sheetName: "Crop Intensification",
    fields: [
      { key: "event_date", label: "Date", type: "date", inTable: true, width: 14 },
      { key: "zone", label: "Zone # (1, 2 or 3)", type: "select", inTable: true, options: ["1", "2", "3"], hint: "The zone the county falls in on the worksheet's lookup.", width: 16 },
      { key: "in_use", label: "Practice in use", type: "boolean", inTable: true, width: 14 },
      { key: "crops_per_period", label: "Number of crops", type: "number", inTable: true, min: 0, max: 99, step: "0.01", width: 16 },
      { key: "period_years", label: "Over years", type: "number", inTable: true, min: 1, max: 10, step: "0.01", width: 12 },
      { key: "fallow_eliminated", label: "Fallow eliminated", type: "boolean", inTable: true, width: 16 },
    ],
  },
  {
    key: "animal_integration",
    label: "Animal Integration",
    singular: "Animal Integration Record",
    sheetName: "Animal Integration",
    fields: [
      { key: "event_date", label: "Date", type: "date", inTable: true, width: 14 },
      { key: "animal_breed", label: "Animal Breed", type: "text", inTable: true, maxLength: 150, placeholder: "Angus", width: 20 },
      { key: "grazing_period", label: "Grazing Period", type: "text", inTable: true, maxLength: 100, placeholder: "Nov to Feb", width: 20 },
      { key: "biomass_foraged_pct", label: "% biomass foraged", type: "number", inTable: true, min: 0, max: 100, step: "0.01", width: 18 },
    ],
  },
] as const;

export const MODULE_BY_KEY: Record<ModuleKey, ModuleDef> = MODULES.reduce(
  (acc, m) => {
    acc[m.key] = m;
    return acc;
  },
  {} as Record<ModuleKey, ModuleDef>
);

/** Columns shown in the table, as opposed to form-only ones. */
export function tableFields(module: ModuleKey): ModuleField[] {
  return MODULE_BY_KEY[module].fields.filter((f) => f.inTable);
}

/** Every column, for the form and for the export. */
export function allFields(module: ModuleKey): readonly ModuleField[] {
  return MODULE_BY_KEY[module].fields;
}

export const STATUS_LABEL: Record<string, string> = {
  in_progress: "In Progress",
  completed: "Completed",
};
