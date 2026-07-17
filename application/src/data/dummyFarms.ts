import type { ActivityEntry, Farm, FarmDocument, SoilMetric } from '../types/farm';

export const dummyFarms: Farm[] = [
  {
    id: 'farm-1',
    name: 'Green Valley Farm',
    ownerName: 'John Carter',
    location: 'Illinois, USA',
    areaAcres: 1250,
    fieldsCount: 4,
    status: 'active',
    lastUpdatedISO: '2024-04-20T10:30:00.000Z',
    soilType: 'Silty Clay Loam',
    regenScore: 72,
  },
  {
    id: 'farm-2',
    name: 'Riverbend Farm',
    ownerName: 'Maria Lopez',
    location: 'Illinois, USA',
    areaAcres: 860,
    fieldsCount: 3,
    status: 'active',
    lastUpdatedISO: '2024-04-12T08:00:00.000Z',
    soilType: 'Sandy Loam',
    regenScore: 64,
  },
  {
    id: 'farm-3',
    name: 'Hilltop Farm',
    ownerName: 'David Nguyen',
    location: 'Iowa, USA',
    areaAcres: 640,
    fieldsCount: 2,
    status: 'pending',
    lastUpdatedISO: '2024-03-28T14:15:00.000Z',
    soilType: 'Loam',
    regenScore: 58,
  },
];

export const dummyFarmActivity: Record<string, ActivityEntry[]> = {
  'farm-1': [
    {
      id: 'fa-1',
      title: 'Self assessment completed',
      description: '2024 Annual Assessment marked in progress',
      dateISO: '2024-04-20T10:30:00.000Z',
      icon: 'clipboard-check-outline',
    },
    {
      id: 'fa-2',
      title: 'Field added',
      description: 'West Field (300 ac) added to the farm',
      dateISO: '2024-03-15T09:00:00.000Z',
      icon: 'shape-square-plus',
    },
    {
      id: 'fa-3',
      title: 'Farm created',
      description: 'Green Valley Farm onboarded to iiGrain',
      dateISO: '2024-01-10T12:00:00.000Z',
      icon: 'barn',
    },
  ],
};

export const dummyFarmSoil: Record<string, SoilMetric[]> = {
  'farm-1': [
    { id: 's-1', label: 'Soil Type', value: 'Silty Clay Loam', icon: 'layers-outline', tone: 'info' },
    { id: 's-2', label: 'Organic Matter', value: '4.2%', icon: 'leaf', tone: 'success' },
    { id: 's-3', label: 'pH Level', value: '6.8', icon: 'flask-outline', tone: 'success' },
    { id: 's-4', label: 'Moisture', value: '32%', icon: 'water-outline', tone: 'warning' },
  ],
};

export const dummyFarmDocuments: Record<string, FarmDocument[]> = {
  'farm-1': [
    { id: 'd-1', name: 'Soil Test Report 2024.pdf', sizeLabel: '1.2 MB', dateISO: '2024-04-02T00:00:00.000Z', icon: 'file-pdf-box' },
    { id: 'd-2', name: 'Field Boundaries.png', sizeLabel: '820 KB', dateISO: '2024-03-18T00:00:00.000Z', icon: 'file-image-outline' },
    { id: 'd-3', name: 'Lease Agreement.pdf', sizeLabel: '460 KB', dateISO: '2024-01-09T00:00:00.000Z', icon: 'file-document-outline' },
  ],
};

export const getFarms = (): Farm[] => dummyFarms;

export const getFarmById = (farmId: string): Farm | undefined =>
  dummyFarms.find(farm => farm.id === farmId);

export const getFarmActivity = (farmId: string): ActivityEntry[] =>
  dummyFarmActivity[farmId] ?? [];

export const getFarmSoil = (farmId: string): SoilMetric[] => dummyFarmSoil[farmId] ?? [];

export const getFarmDocuments = (farmId: string): FarmDocument[] =>
  dummyFarmDocuments[farmId] ?? [];
