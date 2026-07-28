import type { AssessmentStatus } from '../../types/assessment';
import type {
  AssessorDashboard,
  AssessorFarmRow,
  AssessorFieldEntry,
  AssessorFieldsOverview,
  AssessorHistoryGroup,
  AssessorHistoryItem,
  AssignedFarmer,
} from '../../types/assessor';

const groupByOrdered = <T>(
  items: T[],
  keyOf: (item: T) => string,
): { key: string; items: T[] }[] => {
  const order: string[] = [];
  const buckets: Record<string, T[]> = {};
  for (const item of items) {
    const key = keyOf(item);
    if (!buckets[key]) {
      buckets[key] = [];
      order.push(key);
    }
    buckets[key].push(item);
  }
  return order.map(key => ({ key, items: buckets[key] }));
};

const byNewest = (a: string | null, b: string | null): number =>
  (b ?? '').localeCompare(a ?? '');

const toAssignedFarmer = (farmerId: string, entries: AssessorFieldEntry[]): AssignedFarmer => {
  const farms = new Set(entries.map(e => e.farm.id));
  const pendingCount = entries.filter(e => !e.assessment.completed).length;
  const anyProgress = entries.some(
    e => e.assessment.status === 'IN_PROGRESS' || e.assessment.answered > 0,
  );
  const status: AssessmentStatus =
    pendingCount === 0 ? 'COMPLETED' : anyProgress ? 'IN_PROGRESS' : 'PENDING';
  return {
    id: farmerId,
    name: entries[0]?.farmer.name ?? '',
    email: '',
    note: null,
    farmsCount: farms.size,
    fieldsCount: entries.length,
    pendingCount,
    status,
    assignedAtISO: '',
  };
};

export const deriveAssignedFarmers = (overview: AssessorFieldsOverview): AssignedFarmer[] =>
  groupByOrdered(overview.fields, e => e.farmer.id).map(({ key, items }) =>
    toAssignedFarmer(key, items),
  );

export const deriveFarmerFarms = (
  overview: AssessorFieldsOverview,
  farmerId: string,
): AssessorFarmRow[] => {
  const mine = overview.fields.filter(e => e.farmer.id === farmerId);
  return groupByOrdered(mine, e => e.farm.id).map(({ key, items }) => {
    const doneCount = items.filter(e => e.assessment.completed).length;
    return {
      id: key,
      name: items[0]?.farm.name ?? '',
      fieldsCount: items.length,
      doneCount,
      pendingCount: items.length - doneCount,
    };
  });
};

export const deriveFarmFields = (
  overview: AssessorFieldsOverview,
  farmId: string,
): AssessorFieldEntry[] => overview.fields.filter(e => e.farm.id === farmId);

const toHistoryItem = (
  entry: AssessorFieldEntry,
  year: number,
): AssessorHistoryItem => ({
  fieldId: entry.field.id,
  programId: entry.program.id,
  fieldName: entry.field.name,
  farmName: entry.farm.name,
  year,
  percentage: entry.assessment.percentage,
  submittedBy: { id: '', name: '', role: 'assessor' },
  submittedAtISO: entry.assessment.submittedAtISO ?? '',
  locked: true,
});

export const deriveHistoryGroups = (
  overview: AssessorFieldsOverview,
): AssessorHistoryGroup[] => {
  const completed = overview.fields.filter(e => e.assessment.completed);
  return groupByOrdered(completed, e => e.farmer.id).map(({ key, items }) => ({
    farmerId: key,
    farmerName: items[0]?.farmer.name ?? '',
    items: items
      .map(e => toHistoryItem(e, overview.year))
      .sort((a, b) => byNewest(a.submittedAtISO, b.submittedAtISO)),
  }));
};

export const deriveDashboard = (overview: AssessorFieldsOverview): AssessorDashboard => {
  const assigned = deriveAssignedFarmers(overview);
  const recent = deriveHistoryGroups(overview)
    .flatMap(group => group.items)
    .sort((a, b) => byNewest(a.submittedAtISO, b.submittedAtISO))
    .slice(0, 4);

  const totalFields = overview.fields.length;
  const doneFields = overview.fields.filter(e => e.assessment.completed).length;
  return {
    counts: {
      assigned: assigned.length,
      done: doneFields,
      pending: Math.max(totalFields - doneFields, 0),
    },
    recent,
    assignedPreview: assigned.slice(0, 3),
  };
};
