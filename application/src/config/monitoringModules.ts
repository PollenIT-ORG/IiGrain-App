import type { BadgeTone } from '../types/farm';
import type { DocumentKind, ModuleKey } from '../types/monitoring';
import { MODULE_KEYS } from '../types/monitoring';


export type MonitoringFieldType = 'date' | 'text' | 'number' | 'select' | 'boolean';

export type MonitoringFieldWidth = 'full' | 'half' | 'third';

export interface MonitoringSelectOption {
  value: string;
  label: string;
}

export interface MonitoringFieldDef {
  key: string;
  label: string;
  errorLabel?: string;
  type: MonitoringFieldType;
  width?: MonitoringFieldWidth;
  required?: boolean;
  placeholder?: string;
  helper?: string;
  maxLength?: number;
  min?: number;
  max?: number;
  decimals?: number;
  allowNegative?: boolean;
  options?: readonly MonitoringSelectOption[];
  strictEnum?: boolean;
  notBefore?: string;
  gpsPair?: 'latitude' | 'longitude';
  unit?: string;
}

export interface MonitoringModuleDef {
  key: ModuleKey;
  label: string;
  description: string;
  icon: string;
  tone: BadgeTone;
  noun: string;
  addLabel: string;
  emptyTitle: string;
  emptyMessage: string;
  dateKey: string | null;
  titleKey: string | null;
  summaryKeys: readonly string[];
  defaultDocumentKind: DocumentKind;
  presence?: {
    key: string;
    present: string;
    absent: string;
  };
  fields: readonly MonitoringFieldDef[];
}


const opts = (values: readonly string[]): MonitoringSelectOption[] =>
  values.map(value => ({ value, label: value }));

export const RATE_UNITS = opts([
  'lbs / acre',
  'tons / acre',
  'gal / acre',
  'qt / acre',
  'pt / acre',
  'oz / acre',
  'kg / acre',
]);

export const APPLICATION_METHODS = opts([
  'Broadcast',
  'Banded',
  'In-furrow',
  'Foliar',
  'Spray rig',
  'Injected',
  'Ground',
  'Aerial',
  'Other',
]);

const IRRIGATION_TYPES = opts([
  'Pivot',
  'Center Pivot Irrigation',
  'Drip Irrigation',
  'Furrow Irrigation',
  'Flood',
  'Sprinkler',
  'Other',
]);

const IRRIGATION_SOURCES = opts([
  'Well',
  'Surface water',
  'Canal',
  'Pond',
  'Municipal',
  'Other',
]);

const PRODUCT_TYPES = opts([
  'Herbicide',
  'Insecticide',
  'Fungicide',
  'Nematicide',
  'Rodenticide',
  'Biological',
  'Other',
]);

const FERTILIZER_FORMS = opts(['Granular', 'Liquid', 'Gas', 'Slow release']);

const TILLAGE_TYPES = opts([
  'No Till',
  'Strip Till',
  'Reduced Till',
  'Conservation Tillage',
  'Conventional Tillage',
  'Vertical Tillage',
]);

const SOIL_MOISTURE = opts(['Dry', 'Moderate', 'Wet']);

const AMENDMENT_TYPES = opts(['Manure', 'Compost', 'Biochar', 'Other']);

const AMENDMENT_SOURCES = opts(['On-farm', 'Purchased', 'Other']);

const CROP_TYPES: MonitoringSelectOption[] = [
  { value: 'cash', label: 'Cash crop' },
  { value: 'cover', label: 'Cover crop' },
  { value: 'forage', label: 'Forage' },
];

const YIELD_UNITS = opts(['bu / acre', 'lbs / acre', 'tons / acre', 'cwt / acre']);


const pct = (key: string, label: string, errorLabel: string): MonitoringFieldDef => ({
  key,
  label,
  errorLabel,
  type: 'number',
  width: 'third',
  min: 0,
  max: 100,
  decimals: 2,
  placeholder: '0',
});

const NPK: readonly MonitoringFieldDef[] = [
  pct('n_pct', 'N (%)', 'Nitrogen percent'),
  pct('p2o5_pct', 'P2O5 (%)', 'Phosphate percent'),
  pct('k2o_pct', 'K2O (%)', 'Potash percent'),
];


const TRAINING: MonitoringModuleDef = {
  key: 'training',
  label: 'Training',
  description: 'Record training events and hours',
  icon: 'school-outline',
  tone: 'info',
  noun: 'training record',
  addLabel: 'Add Training Record',
  emptyTitle: 'No training recorded',
  emptyMessage: 'Add the first training attended for this field this season.',
  dateKey: 'training_date',
  titleKey: 'topic',
  summaryKeys: ['organizer', 'hours'],
  defaultDocumentKind: 'certificate',
  fields: [
    { key: 'training_date', label: 'Training Date', errorLabel: 'Training date', type: 'date' },
    {
      key: 'topic',
      label: 'Topic',
      type: 'text',
      maxLength: 200,
      placeholder: 'e.g. Cover crop management',
    },
    {
      key: 'organizer',
      label: 'Organizer',
      type: 'text',
      maxLength: 200,
      placeholder: 'Who ran the session',
    },
    {
      key: 'hours',
      label: 'Hours',
      type: 'number',
      width: 'half',
      min: 0,
      max: 999,
      decimals: 2,
      placeholder: '0',
    },
  ],
};

const SOIL_SAMPLES: MonitoringModuleDef = {
  key: 'soil_samples',
  label: 'Soil Samples',
  description: 'Record soil test results and upload reports',
  icon: 'test-tube',
  tone: 'success',
  noun: 'sample point',
  addLabel: 'Add Sample Point',
  emptyTitle: 'No sampling points yet',
  emptyMessage:
    'Add a record and this field’s surveyed points are saved with it — each with its own latitude and longitude.',
  dateKey: 'sample_date',
  titleKey: 'point_label',
  summaryKeys: ['soil_texture', 'soc_0_2'],
  defaultDocumentKind: 'lab_report',
  presence: { key: 'sample_date', present: 'Results entered', absent: 'Not sampled' },
  fields: [
    {
      key: 'point_label',
      label: 'Point Label',
      errorLabel: 'Point label',
      type: 'text',
      required: true,
      maxLength: 60,
      placeholder: 'e.g. Point 1',
      helper: 'How this point is told apart from the others.',
    },
    {
      key: 'sample_date',
      label: 'Sample Date',
      errorLabel: 'Sample date',
      type: 'date',
      helper: 'Leave empty until the point has actually been sampled.',
    },
    {
      key: 'latitude',
      label: 'Latitude',
      type: 'number',
      width: 'half',
      min: -90,
      max: 90,
      decimals: 6,
      allowNegative: true,
      gpsPair: 'latitude',
      placeholder: '00.000000',
    },
    {
      key: 'longitude',
      label: 'Longitude',
      type: 'number',
      width: 'half',
      min: -180,
      max: 180,
      decimals: 6,
      allowNegative: true,
      gpsPair: 'longitude',
      placeholder: '00.000000',
    },
    {
      key: 'soc_0_2',
      label: 'SOC 0-2 (%)',
      errorLabel: 'SOC 0-2',
      type: 'number',
      width: 'third',
      min: 0,
      max: 100,
      decimals: 3,
      placeholder: '0',
    },
    {
      key: 'soc_2_6',
      label: 'SOC 2-6 (%)',
      errorLabel: 'SOC 2-6',
      type: 'number',
      width: 'third',
      min: 0,
      max: 100,
      decimals: 3,
      placeholder: '0',
    },
    {
      key: 'was_0_2',
      label: 'WAS 0-2 (%)',
      errorLabel: 'WAS 0-2',
      type: 'number',
      width: 'third',
      min: 0,
      max: 100,
      decimals: 3,
      placeholder: '0',
    },
    {
      key: 'soil_texture',
      label: 'Soil Type / Texture',
      errorLabel: 'Soil texture',
      type: 'text',
      maxLength: 100,
      placeholder: 'e.g. Silt Loam',
    },
    {
      key: 'soil_series',
      label: 'Soil Series',
      errorLabel: 'Soil series',
      type: 'text',
      maxLength: 150,
      placeholder: 'e.g. Pullman',
    },
  ],
};

const IRRIGATION: MonitoringModuleDef = {
  key: 'irrigation',
  label: 'Irrigation',
  description: 'Record irrigation events and amounts',
  icon: 'water-outline',
  tone: 'info',
  noun: 'irrigation record',
  addLabel: 'Add Irrigation Record',
  emptyTitle: 'No irrigation recorded',
  emptyMessage: 'Every pass over this field is its own record. Add the first one.',
  dateKey: 'irrigation_date',
  titleKey: 'irrigation_type',
  summaryKeys: ['amount_inches', 'source'],
  defaultDocumentKind: 'document',
  fields: [
    {
      key: 'irrigation_date',
      label: 'Irrigation Date',
      errorLabel: 'Irrigation date',
      type: 'date',
    },
    {
      key: 'irrigation_type',
      label: 'Irrigation Type',
      errorLabel: 'Irrigation type',
      type: 'select',
      options: IRRIGATION_TYPES,
      maxLength: 100,
    },
    {
      key: 'amount_inches',
      label: 'Amount (inches)',
      errorLabel: 'Amount in inches',
      type: 'number',
      width: 'half',
      min: 0,
      max: 9999,
      decimals: 2,
      placeholder: '0.00',
    },
    {
      key: 'amount_gallons_ac',
      label: 'Amount (gallons/acre)',
      errorLabel: 'Amount in gallons per acre',
      type: 'number',
      width: 'half',
      min: 0,
      max: 9999999,
      decimals: 2,
      placeholder: '0',
    },
    {
      key: 'source',
      label: 'Source',
      type: 'select',
      options: IRRIGATION_SOURCES,
      maxLength: 100,
    },
  ],
};

const PESTICIDE: MonitoringModuleDef = {
  key: 'pesticide',
  label: 'Pesticide Use',
  description: 'Record pesticide applications',
  icon: 'spray',
  tone: 'warning',
  noun: 'application',
  addLabel: 'Add Pesticide Application',
  emptyTitle: 'No applications recorded',
  emptyMessage: 'Add each product applied to this field, with its rate and method.',
  dateKey: 'application_date',
  titleKey: 'product',
  summaryKeys: ['product_type', 'rate', 'application_method'],
  defaultDocumentKind: 'document',
  fields: [
    {
      key: 'application_date',
      label: 'Application Date',
      errorLabel: 'Application date',
      type: 'date',
    },
    {
      key: 'product',
      label: 'Pesticide / Product',
      errorLabel: 'Product',
      type: 'text',
      maxLength: 200,
      placeholder: 'e.g. Atrazine 4L',
    },
    {
      key: 'product_type',
      label: 'Product Type',
      errorLabel: 'Product type',
      type: 'select',
      options: PRODUCT_TYPES,
      maxLength: 100,
    },
    {
      key: 'rate',
      label: 'Rate',
      type: 'number',
      width: 'half',
      min: 0,
      max: 999999,
      decimals: 3,
      placeholder: '0.000',
    },
    {
      key: 'rate_unit',
      label: 'Rate Unit',
      errorLabel: 'Rate unit',
      type: 'select',
      width: 'half',
      options: RATE_UNITS,
      maxLength: 50,
    },
    {
      key: 'application_method',
      label: 'Application Method',
      errorLabel: 'Application method',
      type: 'select',
      options: APPLICATION_METHODS,
      maxLength: 100,
    },
  ],
};

const FERTILIZER: MonitoringModuleDef = {
  key: 'fertilizer',
  label: 'Synthetic Fertilizer',
  description: 'Record synthetic fertilizer applications',
  icon: 'shaker-outline',
  tone: 'neutral',
  noun: 'application',
  addLabel: 'Add Fertilizer Application',
  emptyTitle: 'No fertilizer recorded',
  emptyMessage: 'Add each application, with the analysis printed on the bag.',
  dateKey: 'application_date',
  titleKey: 'fertilizer_type',
  summaryKeys: ['form', 'rate_lbs_acre', 'application_method'],
  defaultDocumentKind: 'document',
  fields: [
    {
      key: 'application_date',
      label: 'Application Date',
      errorLabel: 'Application date',
      type: 'date',
    },
    {
      key: 'fertilizer_type',
      label: 'Fertilizer Type',
      errorLabel: 'Fertilizer type',
      type: 'text',
      maxLength: 150,
      placeholder: 'e.g. Urea (46-0-0)',
    },
    {
      key: 'form',
      label: 'Form',
      type: 'select',
      width: 'half',
      options: FERTILIZER_FORMS,
      maxLength: 50,
    },
    {
      key: 'application_method',
      label: 'Application Method',
      errorLabel: 'Application method',
      type: 'select',
      width: 'half',
      options: APPLICATION_METHODS,
      maxLength: 100,
    },
    {
      key: 'rate_lbs_acre',
      label: 'Rate (lbs/acre)',
      errorLabel: 'Rate in lbs per acre',
      type: 'number',
      min: 0,
      max: 999999,
      decimals: 2,
      placeholder: '0.00',
    },
    ...NPK,
  ],
};

const TILLAGE: MonitoringModuleDef = {
  key: 'tillage',
  label: 'Tillage',
  description: 'Record tillage operations',
  icon: 'tractor-variant',
  tone: 'warning',
  noun: 'tillage record',
  addLabel: 'Add Tillage Record',
  emptyTitle: 'No tillage recorded',
  emptyMessage: 'Add each pass, its depth and the residue left behind.',
  dateKey: 'tillage_date',
  titleKey: 'implement',
  summaryKeys: ['tillage_type', 'depth_inches', 'residue_after_pct'],
  defaultDocumentKind: 'document',
  fields: [
    { key: 'tillage_date', label: 'Tillage Date', errorLabel: 'Tillage date', type: 'date' },
    {
      key: 'implement',
      label: 'Implement / Tool',
      errorLabel: 'Implement',
      type: 'text',
      maxLength: 150,
      placeholder: 'e.g. Vertical Tillage',
    },
    {
      key: 'tillage_type',
      label: 'Tillage Type',
      errorLabel: 'Tillage type',
      type: 'select',
      options: TILLAGE_TYPES,
      maxLength: 100,
    },
    {
      key: 'depth_inches',
      label: 'Depth (inches)',
      errorLabel: 'Depth in inches',
      type: 'number',
      width: 'half',
      min: 0,
      max: 999,
      decimals: 2,
      placeholder: '0.00',
    },
    {
      key: 'soil_moisture',
      label: 'Soil Moisture',
      errorLabel: 'Soil moisture',
      type: 'select',
      width: 'half',
      options: SOIL_MOISTURE,
      maxLength: 50,
    },
    {
      key: 'residue_before_pct',
      label: 'Residue Before (%)',
      errorLabel: 'Residue before planting',
      type: 'number',
      width: 'half',
      min: 0,
      max: 100,
      decimals: 2,
      placeholder: '0',
    },
    {
      key: 'residue_after_pct',
      label: 'Residue After (%)',
      errorLabel: 'Residue after tillage',
      type: 'number',
      width: 'half',
      min: 0,
      max: 100,
      decimals: 2,
      placeholder: '0',
    },
  ],
};

const AMENDMENT: MonitoringModuleDef = {
  key: 'amendment',
  label: 'Organic Amendments',
  description: 'Record manure, compost and other amendments',
  icon: 'compost',
  tone: 'success',
  noun: 'amendment',
  addLabel: 'Add Organic Amendment',
  emptyTitle: 'No amendments recorded',
  emptyMessage: 'Add each amendment spread on this field, with its rate and analysis.',
  dateKey: 'application_date',
  titleKey: 'amendment_type',
  summaryKeys: ['source', 'rate', 'incorporated'],
  defaultDocumentKind: 'document',
  fields: [
    {
      key: 'application_date',
      label: 'Application Date',
      errorLabel: 'Application date',
      type: 'date',
    },
    {
      key: 'amendment_type',
      label: 'Amendment Type',
      errorLabel: 'Amendment type',
      type: 'select',
      options: AMENDMENT_TYPES,
      maxLength: 150,
    },
    {
      key: 'source',
      label: 'Source',
      type: 'select',
      options: AMENDMENT_SOURCES,
      maxLength: 100,
    },
    {
      key: 'rate',
      label: 'Application Rate',
      errorLabel: 'Rate',
      type: 'number',
      width: 'half',
      min: 0,
      max: 999999,
      decimals: 2,
      placeholder: '0.00',
    },
    {
      key: 'rate_unit',
      label: 'Rate Unit',
      errorLabel: 'Rate unit',
      type: 'select',
      width: 'half',
      options: RATE_UNITS,
      maxLength: 50,
    },
    ...NPK,
    { key: 'incorporated', label: 'Incorporated?', type: 'boolean' },
  ],
};

const CROP: MonitoringModuleDef = {
  key: 'crop',
  label: 'Crop Diversification',
  description: 'Record crop diversification details',
  icon: 'sprout-outline',
  tone: 'success',
  noun: 'crop record',
  addLabel: 'Add Crop Record',
  emptyTitle: 'No crops recorded',
  emptyMessage: 'Add each crop grown on this field, cash or cover, with its yield.',
  dateKey: 'planting_date',
  titleKey: 'crop_species',
  summaryKeys: ['crop_type', 'seeding_rate', 'yield_value'],
  defaultDocumentKind: 'document',
  fields: [
    {
      key: 'crop_species',
      label: 'Crop / Species',
      errorLabel: 'Crop species',
      type: 'text',
      maxLength: 150,
      placeholder: 'e.g. Soybean',
    },
    {
      key: 'crop_type',
      label: 'Crop Type',
      errorLabel: 'Crop type',
      type: 'select',
      options: CROP_TYPES,
      strictEnum: true,
      helper: 'The worksheet only recognises cash, cover and forage.',
    },
    {
      key: 'planting_date',
      label: 'Planting Date',
      errorLabel: 'Planting date',
      type: 'date',
      width: 'half',
    },
    {
      key: 'harvest_date',
      label: 'Harvest Date',
      errorLabel: 'Harvest date',
      type: 'date',
      width: 'half',
      notBefore: 'planting_date',
    },
    {
      key: 'seeding_rate',
      label: 'Seeding Rate',
      errorLabel: 'Seeding rate',
      type: 'number',
      width: 'half',
      min: 0,
      max: 999999,
      decimals: 2,
      placeholder: '0.00',
    },
    {
      key: 'seeding_rate_unit',
      label: 'Rate Unit',
      errorLabel: 'Seeding rate unit',
      type: 'select',
      width: 'half',
      options: RATE_UNITS,
      maxLength: 50,
    },
    {
      key: 'yield_value',
      label: 'Yield',
      errorLabel: 'Yield',
      type: 'number',
      width: 'half',
      min: 0,
      max: 9999999,
      decimals: 2,
      placeholder: '0.00',
    },
    {
      key: 'yield_unit',
      label: 'Yield Unit',
      errorLabel: 'Yield unit',
      type: 'select',
      width: 'half',
      options: YIELD_UNITS,
      maxLength: 50,
    },
  ],
};

const NUTRIENT: MonitoringModuleDef = {
  key: 'nutrient',
  label: 'Nutrient Management',
  description: 'Record nutrient management events',
  icon: 'flask-outline',
  tone: 'info',
  noun: 'nutrient event',
  addLabel: 'Add Nutrient Event',
  emptyTitle: 'No nutrient events recorded',
  emptyMessage:
    'Add each event, and mark whether it used variable, split or enhanced-efficiency rates.',
  dateKey: 'event_date',
  titleKey: 'application_method',
  summaryKeys: ['rate_lbs_acre', 'n_pct'],
  defaultDocumentKind: 'document',
  fields: [
    { key: 'event_date', label: 'Event Date', errorLabel: 'Event date', type: 'date' },
    {
      key: 'application_method',
      label: 'Application Method',
      errorLabel: 'Application method',
      type: 'select',
      options: APPLICATION_METHODS,
      maxLength: 100,
    },
    {
      key: 'rate_lbs_acre',
      label: 'Rate (lbs/acre)',
      errorLabel: 'Rate in lbs per acre',
      type: 'number',
      min: 0,
      max: 999999,
      decimals: 2,
      placeholder: '0.00',
    },
    ...NPK,
    { key: 'variable_rate', label: 'Variable Rate', type: 'boolean' },
    { key: 'split_rate', label: 'Split Rate', type: 'boolean' },
    { key: 'enhanced_efficiency', label: 'Enhanced Efficiency', type: 'boolean' },
  ],
};

export const MONITORING_MODULES: Record<ModuleKey, MonitoringModuleDef> = {
  training: TRAINING,
  soil_samples: SOIL_SAMPLES,
  irrigation: IRRIGATION,
  pesticide: PESTICIDE,
  fertilizer: FERTILIZER,
  tillage: TILLAGE,
  amendment: AMENDMENT,
  crop: CROP,
  nutrient: NUTRIENT,
};

export const MONITORING_MODULE_LIST: readonly MonitoringModuleDef[] = MODULE_KEYS.map(
  key => MONITORING_MODULES[key],
);

export const moduleDef = (key: ModuleKey): MonitoringModuleDef => MONITORING_MODULES[key];

export const fieldDef = (
  module: ModuleKey,
  key: string,
): MonitoringFieldDef | undefined =>
  MONITORING_MODULES[module].fields.find(f => f.key === key);

export const NOTES_MAX_LENGTH = 1000;

export const DOCUMENT_MAX_BYTES = 10 * 1024 * 1024;

export const DOCUMENT_EXTENSIONS: readonly string[] = [
  'pdf',
  'jpg',
  'jpeg',
  'png',
  'webp',
  'heic',
  'doc',
  'docx',
];

export const DOCUMENT_KIND_LABELS: Record<DocumentKind, string> = {
  document: 'Document',
  photo: 'Photo',
  lab_report: 'Lab report',
  certificate: 'Certificate',
};
