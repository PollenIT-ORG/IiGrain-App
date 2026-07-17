import type { ActivityEntry, Field } from '../types/farm';

export const dummyFields: Field[] = [
  {
    id: 'field-1',
    farmId: 'farm-1',
    name: 'North Field',
    areaAcres: 320,
    crop: 'Corn',
    season: 'Summer 2024',
    status: 'healthy',
    coordinates: '40.71° N, 89.59° W',
    sowingDateISO: '2024-04-15T00:00:00.000Z',
    expectedHarvestISO: '2024-10-05T00:00:00.000Z',
    irrigation: 'Drip',
    weather: '24°C · Clear',
    healthLabel: 'Healthy',
  },
  {
    id: 'field-2',
    farmId: 'farm-1',
    name: 'East Field',
    areaAcres: 280,
    crop: 'Soybean',
    season: 'Summer 2024',
    status: 'monitor',
    coordinates: '40.72° N, 89.57° W',
    sowingDateISO: '2024-04-22T00:00:00.000Z',
    expectedHarvestISO: '2024-09-28T00:00:00.000Z',
    irrigation: 'Sprinkler',
    weather: '25°C · Cloudy',
    healthLabel: 'Monitor',
  },
  {
    id: 'field-3',
    farmId: 'farm-1',
    name: 'South Field',
    areaAcres: 350,
    crop: 'Wheat',
    season: 'Summer 2024',
    status: 'healthy',
    coordinates: '40.69° N, 89.60° W',
    sowingDateISO: '2024-03-30T00:00:00.000Z',
    expectedHarvestISO: '2024-08-20T00:00:00.000Z',
    irrigation: 'Rain-fed',
    weather: '23°C · Clear',
    healthLabel: 'Healthy',
  },
  {
    id: 'field-4',
    farmId: 'farm-1',
    name: 'West Field',
    areaAcres: 300,
    crop: 'Corn',
    season: 'Summer 2024',
    status: 'critical',
    coordinates: '40.70° N, 89.62° W',
    sowingDateISO: '2024-04-18T00:00:00.000Z',
    expectedHarvestISO: '2024-10-10T00:00:00.000Z',
    irrigation: 'Drip',
    weather: '26°C · Dry',
    healthLabel: 'Needs attention',
  },
  {
    id: 'field-5',
    farmId: 'farm-2',
    name: 'Riverside Plot',
    areaAcres: 410,
    crop: 'Corn',
    season: 'Summer 2024',
    status: 'healthy',
    coordinates: '41.10° N, 89.20° W',
    sowingDateISO: '2024-04-10T00:00:00.000Z',
    expectedHarvestISO: '2024-09-30T00:00:00.000Z',
    irrigation: 'Sprinkler',
    weather: '22°C · Clear',
    healthLabel: 'Healthy',
  },
];

export const dummyFieldActivity: Record<string, ActivityEntry[]> = {
  'field-1': [
    {
      id: 'fl-1',
      title: 'Irrigation cycle completed',
      description: 'Drip irrigation ran for 4 hours',
      dateISO: '2024-05-02T06:00:00.000Z',
      icon: 'water-outline',
    },
    {
      id: 'fl-2',
      title: 'Fertilizer applied',
      description: 'Nitrogen-rich blend across the field',
      dateISO: '2024-04-25T07:30:00.000Z',
      icon: 'sprout-outline',
    },
    {
      id: 'fl-3',
      title: 'Sowing completed',
      description: 'Corn sown across 320 acres',
      dateISO: '2024-04-15T08:00:00.000Z',
      icon: 'seed-outline',
    },
  ],
};

export const getFieldsByFarm = (farmId: string): Field[] =>
  dummyFields.filter(field => field.farmId === farmId);

export const getFieldById = (fieldId: string): Field | undefined =>
  dummyFields.find(field => field.id === fieldId);

export const getFieldActivity = (fieldId: string): ActivityEntry[] =>
  dummyFieldActivity[fieldId] ?? [];
