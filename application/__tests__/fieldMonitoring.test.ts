import { Endpoints } from '../src/config/endpoints';
import { MODULE_KEYS, isModuleKey } from '../src/types/monitoring';
import {
  MONITORING_MODULES,
  moduleDef,
  takesFieldPoints,
} from '../src/config/monitoringModules';
import {
  recordTitle,
  summaryLine,
  validateRecordForm,
} from '../src/utils/monitoringValues';
import reducer, { setMonitoringScope } from '../src/redux/slices/monitoringSlice';
import { fieldPointsScopeKey } from '../src/redux/slices/boundarySlice';

const FIELD = 'field-1';

describe('field monitoring endpoints', () => {
  it('are scoped to a field, never a program', () => {
    const urls = [
      Endpoints.fieldMonitoring.farmFields('farm-1'),
      Endpoints.fieldMonitoring.modules(FIELD),
      Endpoints.fieldMonitoring.records(FIELD, 'training'),
      Endpoints.fieldMonitoring.record(FIELD, 'training', 'rec-1'),
      Endpoints.fieldMonitoring.documents(FIELD),
      Endpoints.fieldMonitoring.documentUpload(FIELD),
      Endpoints.fieldMonitoring.document(FIELD, 'doc-1'),
    ];
    for (const url of urls) {
      expect(url).not.toContain('program');
    }
    expect(Endpoints.fieldMonitoring.farmFields('farm-1')).toBe(
      '/field-monitoring/farms/farm-1/fields',
    );
    expect(Endpoints.fieldMonitoring.records(FIELD, 'training')).toBe(
      '/field-monitoring/fields/field-1/modules/training',
    );
  });
});

describe('module registry', () => {
  it('carries all eleven modules', () => {
    expect(MODULE_KEYS).toHaveLength(11);
    expect(MODULE_KEYS).toContain('crop_intensification');
    expect(MODULE_KEYS).toContain('animal_integration');
    expect(isModuleKey('animal_integration')).toBe(true);
  });

  it('defines every key exactly once', () => {
    expect(Object.keys(MONITORING_MODULES).sort()).toEqual([...MODULE_KEYS].sort());
    for (const key of MODULE_KEYS) {
      expect(moduleDef(key).key).toBe(key);
    }
  });
});

describe('new module validation mirrors the server', () => {
  it('accepts a zone the server accepts', () => {
    const { ok } = validateRecordForm(
      'crop_intensification',
      { zone: '2', crops_per_period: '3', period_years: '2' },
      '',
    );
    expect(ok).toBe(true);
  });

  it('refuses a zone outside 1 to 3', () => {
    const { ok, errors } = validateRecordForm(
      'crop_intensification',
      { zone: '9' },
      '',
    );
    expect(ok).toBe(false);
    expect(errors.zone).toBeTruthy();
  });

  it.each([
    ['crops_per_period', '100'],
    ['period_years', '11'],
    ['period_years', '0'],
  ])('refuses %s of %s', (key, value) => {
    const { ok, errors } = validateRecordForm(
      'crop_intensification',
      { [key]: value },
      '',
    );
    expect(ok).toBe(false);
    expect(errors[key as string]).toBeTruthy();
  });

  it('refuses biomass foraged above 100 percent', () => {
    const { ok, errors } = validateRecordForm(
      'animal_integration',
      { biomass_foraged_pct: '150' },
      '',
    );
    expect(ok).toBe(false);
    expect(errors.biomass_foraged_pct).toBeTruthy();
  });

  it('accepts a grazing record inside the server limits', () => {
    const { ok } = validateRecordForm(
      'animal_integration',
      {
        animal_breed: 'Angus cattle',
        grazing_period: '3 weeks after harvest',
        biomass_foraged_pct: '42.5',
      },
      '',
    );
    expect(ok).toBe(true);
  });

  it('refuses an over-long animal breed', () => {
    const { ok, errors } = validateRecordForm(
      'animal_integration',
      { animal_breed: 'x'.repeat(151) },
      '',
    );
    expect(ok).toBe(false);
    expect(errors.animal_breed).toBeTruthy();
  });
});

describe('new module display strings', () => {
  const intensification = {
    id: 'r1',
    status: 'in_progress' as const,
    notes: '',
    documentCount: 0,
    createdAtISO: null,
    updatedAtISO: null,
    values: { zone: '2', crops_per_period: 3, period_years: 2 },
  };

  const grazing = {
    id: 'r2',
    status: 'completed' as const,
    notes: '',
    documentCount: 0,
    createdAtISO: null,
    updatedAtISO: null,
    values: {
      animal_breed: 'Angus cattle',
      grazing_period: '3 weeks after harvest',
      biomass_foraged_pct: 42.5,
    },
  };

  it('titles an intensification record by its zone label, not the raw code', () => {
    expect(recordTitle('crop_intensification', intensification)).toBe('Zone 2');
  });

  it('gives every number in the summary line a unit', () => {
    expect(summaryLine('crop_intensification', intensification)).toBe('3 crops · 2 yrs');
    expect(summaryLine('animal_integration', grazing)).toBe(
      '3 weeks after harvest · 42.5 %',
    );
  });

  it('titles a grazing record by its breed', () => {
    expect(recordTitle('animal_integration', grazing)).toBe('Angus cattle');
  });
});

describe('monitoring scope guard', () => {
  it('resets cached state when the field changes and ignores stale results', () => {
    const loaded = reducer(
      reducer(undefined, setMonitoringScope({ fieldId: 'field-a' })),
      {
        type: 'monitoring/modules/fulfilled',
        payload: {
          context: {
            fieldId: 'field-a',
            fieldName: 'A',
            farmName: 'Farm',
            ownerId: 'o',
          },
          modules: [],
        },
        meta: { arg: { fieldId: 'field-a' } },
      },
    );
    expect(loaded.context?.fieldId).toBe('field-a');

    const switched = reducer(loaded, setMonitoringScope({ fieldId: 'field-b' }));
    expect(switched.scope).toBe('field-b');
    expect(switched.modules).toBeNull();
    expect(switched.context).toBeNull();

    const stale = reducer(switched, {
      type: 'monitoring/modules/fulfilled',
      payload: {
        context: { fieldId: 'field-a', fieldName: 'A', farmName: 'Farm', ownerId: 'o' },
        modules: [],
      },
      meta: { arg: { fieldId: 'field-a' } },
    });
    expect(stale.context).toBeNull();
    expect(stale.modules).toBeNull();
  });
});

describe('field point seeding is confined to modules that record coordinates', () => {
  it('only soil samples carries a GPS point pair', () => {
    const gpsModules = MODULE_KEYS.filter(key =>
      moduleDef(key).fields.some(f => f.gpsPair),
    );
    expect(gpsModules).toEqual(['soil_samples']);
  });

  it('gives soil samples both halves of the pair', () => {
    const fields = moduleDef('soil_samples').fields;
    expect(fields.some(f => f.gpsPair === 'latitude')).toBe(true);
    expect(fields.some(f => f.gpsPair === 'longitude')).toBe(true);
  });

  it.each(MODULE_KEYS.filter(key => key !== 'soil_samples'))(
    'never seeds boundary points into %s',
    key => {
      const fields = moduleDef(key).fields;
      expect(fields.some(f => f.gpsPair)).toBe(false);
      expect(fields.some(f => f.key === 'point_label')).toBe(false);
    },
  );

  it('scopes the seeded flag per module so one module cannot suppress another', () => {
    expect(fieldPointsScopeKey('field-1', 'training')).not.toBe(
      fieldPointsScopeKey('field-1', 'soil_samples'),
    );
    expect(fieldPointsScopeKey('field-1', 'soil_samples')).toBe(
      fieldPointsScopeKey('field-1', 'soil_samples'),
    );
    expect(fieldPointsScopeKey('field-1', 'soil_samples')).not.toBe(
      fieldPointsScopeKey('field-2', 'soil_samples'),
    );
  });
});

describe('modules locked until the field boundary is drawn', () => {
  it('locks soil samples, because its records are points on the field', () => {
    expect(takesFieldPoints('soil_samples')).toBe(true);
  });

  it.each(MODULE_KEYS.filter(key => key !== 'soil_samples'))(
    'leaves %s open without a boundary',
    key => {
      expect(takesFieldPoints(key)).toBe(false);
    },
  );

  it('locks exactly the modules that seed boundary points, and no others', () => {
    const locked = MODULE_KEYS.filter(takesFieldPoints);
    const seeds = MODULE_KEYS.filter(key =>
      moduleDef(key).fields.some(f => f.gpsPair),
    );
    expect(locked).toEqual(seeds);
  });
});

describe('takesFieldPoints matches the backend column rule', () => {
  it('requires all three point columns, not just a coordinate pair', () => {
    const soil = moduleDef('soil_samples').fields.map(f => f.key);
    expect(soil).toContain('point_label');
    expect(soil).toContain('latitude');
    expect(soil).toContain('longitude');
  });

  it('refuses a module that has coordinates but no point label', () => {
    const partial = MODULE_KEYS.filter(key => {
      const keys = moduleDef(key).fields.map(f => f.key);
      const hasCoords = keys.includes('latitude') && keys.includes('longitude');
      return hasCoords && !keys.includes('point_label');
    });
    expect(partial).toEqual([]);
  });
});
