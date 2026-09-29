import { open } from '@op-engineering/op-sqlite';
import {
  DATABASE_NAME,
  asOwnerUserId,
  closeDatabase,
  databaseLocation,
  initializeDatabase,
} from '../src/services/db';
import { upsertLocalUser } from '../src/repositories/userRepository';
import { farmRepository, fieldRepository } from '../src/repositories';
import {
  cacheFarmList,
  cacheFieldList,
  readCachedFarm,
  readCachedFarmList,
  readCachedFieldList,
} from '../src/services/sync/farmCache';
import { createFarmOffline, setSyncLogSink } from '../src/services/sync';
import type { Farm, Field } from '../src/types/farm';

const OWNER_ID = 'farmer-cache';
const OWNER = asOwnerUserId(OWNER_ID);

const farm = (over: Partial<Farm> = {}): Farm => ({
  id: 'srv-farm-1',
  name: 'Green Acres',
  ownerName: 'Asha',
  location: 'Nashik',
  areaAcres: 12.5,
  fieldsCount: 2,
  status: 'active',
  lastUpdatedISO: '2026-09-01T00:00:00Z',
  soilType: 'Loam',
  regenScore: 72,
  latitude: 20.1,
  longitude: 73.8,
  ...over,
});

const field = (over: Partial<Field> = {}): Field => ({
  id: 'srv-field-1',
  farmId: 'srv-farm-1',
  name: 'North block',
  areaAcres: 4.5,
  crop: 'Wheat',
  season: 'Rabi',
  status: 'healthy',
  coordinates: '20.1, 73.8',
  sowingDateISO: '2026-06-01',
  expectedHarvestISO: '2026-11-01',
  irrigation: 'Drip',
  weather: 'Clear',
  healthLabel: 'Healthy',
  hasBoundary: true,
  ...over,
});

beforeEach(async () => {
  setSyncLogSink(() => {});
  await closeDatabase();
  open({ name: DATABASE_NAME, location: databaseLocation() }).delete();
  await initializeDatabase();
  await upsertLocalUser({ id: OWNER_ID });
});

afterAll(async () => {
  setSyncLogSink(null);
  await closeDatabase();
  open({ name: DATABASE_NAME, location: databaseLocation() }).delete();
});

describe('farm list offline', () => {
  it('reads nothing before anything has been seen online', async () => {
    await expect(readCachedFarmList(OWNER)).resolves.toBeNull();
  });

  it('serves the farms the user saw online', async () => {
    await cacheFarmList(OWNER, [farm(), farm({ id: 'srv-farm-2', name: 'Riverside' })]);

    const cached = await readCachedFarmList(OWNER);

    expect(cached?.farms.map(f => f.name)).toEqual(['Green Acres', 'Riverside']);
    expect(cached?.meta.total).toBe(2);
  });

  it('keeps the details the list screen renders', async () => {
    await cacheFarmList(OWNER, [farm()]);

    const [cached] = (await readCachedFarmList(OWNER))?.farms ?? [];

    expect(cached).toMatchObject({
      id: 'srv-farm-1',
      name: 'Green Acres',
      location: 'Nashik',
      areaAcres: 12.5,
      fieldsCount: 2,
      status: 'active',
      latitude: 20.1,
      longitude: 73.8,
    });
  });

  it('survives an app restart', async () => {
    await cacheFarmList(OWNER, [farm()]);

    await closeDatabase();
    await initializeDatabase();

    await expect(readCachedFarmList(OWNER)).resolves.not.toBeNull();
  });

  it('refreshes rather than duplicates when seen again', async () => {
    await cacheFarmList(OWNER, [farm()]);
    await cacheFarmList(OWNER, [farm({ name: 'Green Acres Renamed', fieldsCount: 5 })]);

    const cached = await readCachedFarmList(OWNER);

    expect(cached?.farms).toHaveLength(1);
    expect(cached?.farms[0].name).toBe('Green Acres Renamed');
    expect(cached?.farms[0].fieldsCount).toBe(5);
  });

  it('filters by the search the user typed', async () => {
    await cacheFarmList(OWNER, [farm(), farm({ id: 'srv-farm-2', name: 'Riverside' })]);

    const cached = await readCachedFarmList(OWNER, { search: 'river' });

    expect(cached?.farms.map(f => f.name)).toEqual(['Riverside']);
  });

  it('pages the way the list expects', async () => {
    await cacheFarmList(
      OWNER,
      Array.from({ length: 5 }, (_, i) => farm({ id: `srv-farm-${i}`, name: `Farm ${i}` })),
    );

    const page = await readCachedFarmList(OWNER, { page: 2, limit: 2 });

    expect(page?.farms).toHaveLength(2);
    expect(page?.meta).toMatchObject({ page: 2, limit: 2, total: 5, totalPages: 3 });
  });

  it('includes a farm created offline that the server has never seen', async () => {
    await createFarmOffline(OWNER, { name: 'Made offline' });

    const cached = await readCachedFarmList(OWNER);

    expect(cached?.farms.map(f => f.name)).toContain('Made offline');
  });

  it('reads a single farm for the detail screen', async () => {
    await cacheFarmList(OWNER, [farm()]);

    await expect(readCachedFarm(OWNER, 'srv-farm-1')).resolves.toMatchObject({
      name: 'Green Acres',
    });
    await expect(readCachedFarm(OWNER, 'nope')).resolves.toBeNull();
  });

  it('never leaks farms to another user', async () => {
    await upsertLocalUser({ id: 'other-user' });
    await cacheFarmList(OWNER, [farm()]);

    await expect(readCachedFarmList(asOwnerUserId('other-user'))).resolves.toBeNull();
  });
});

describe('field list offline', () => {
  it('reads nothing for a farm never seen online', async () => {
    await expect(readCachedFieldList(OWNER, 'srv-farm-1')).resolves.toBeNull();
  });

  it('serves the fields the user saw online', async () => {
    await cacheFarmList(OWNER, [farm()]);
    await cacheFieldList(OWNER, 'srv-farm-1', [
      field(),
      field({ id: 'srv-field-2', name: 'South block' }),
    ]);

    const cached = await readCachedFieldList(OWNER, 'srv-farm-1');

    expect(cached?.map(f => f.name)).toEqual(['North block', 'South block']);
    expect(cached?.[0]).toMatchObject({
      farmId: 'srv-farm-1',
      crop: 'Wheat',
      areaAcres: 4.5,
      hasBoundary: true,
    });
  });

  it('ignores fields for a farm that was never cached', async () => {
    await cacheFieldList(OWNER, 'unknown-farm', [field()]);

    await expect(fieldRepository.list(OWNER)).resolves.toHaveLength(0);
  });

  it('keeps fields tied to the right farm', async () => {
    await cacheFarmList(OWNER, [farm(), farm({ id: 'srv-farm-2', name: 'Riverside' })]);
    await cacheFieldList(OWNER, 'srv-farm-1', [field()]);
    await cacheFieldList(OWNER, 'srv-farm-2', [
      field({ id: 'srv-field-9', name: 'Far block', farmId: 'srv-farm-2' }),
    ]);

    await expect(readCachedFieldList(OWNER, 'srv-farm-1')).resolves.toHaveLength(1);
    const other = await readCachedFieldList(OWNER, 'srv-farm-2');
    expect(other?.map(f => f.name)).toEqual(['Far block']);
  });

  it('refreshes rather than duplicates when seen again', async () => {
    await cacheFarmList(OWNER, [farm()]);
    await cacheFieldList(OWNER, 'srv-farm-1', [field()]);
    await cacheFieldList(OWNER, 'srv-farm-1', [field({ crop: 'Barley' })]);

    const cached = await readCachedFieldList(OWNER, 'srv-farm-1');
    expect(cached).toHaveLength(1);
    expect(cached?.[0].crop).toBe('Barley');
  });

  it('never leaks fields to another user', async () => {
    await upsertLocalUser({ id: 'other-user' });
    await cacheFarmList(OWNER, [farm()]);
    await cacheFieldList(OWNER, 'srv-farm-1', [field()]);

    await expect(
      readCachedFieldList(asOwnerUserId('other-user'), 'srv-farm-1'),
    ).resolves.toBeNull();
  });
});

describe('marking what has not reached the server', () => {
  it('does not flag farms that came from the server', async () => {
    await cacheFarmList(OWNER, [farm()]);

    const cached = await readCachedFarmList(OWNER);
    expect(cached?.farms[0].pendingSync).toBe(false);
  });

  it('flags a farm created offline', async () => {
    await createFarmOffline(OWNER, { name: 'Made offline' });

    const cached = await readCachedFarmList(OWNER);
    expect(cached?.farms[0].pendingSync).toBe(true);
  });

  it('flags a farm edited offline even though it has a server id', async () => {
    await cacheFarmList(OWNER, [farm()]);
    const row = await farmRepository.getByServerId(OWNER, 'srv-farm-1');
    await farmRepository.update(OWNER, row?.local_id ?? '', { name: 'Edited' });

    const cached = await readCachedFarmList(OWNER);
    expect(cached?.farms[0].pendingSync).toBe(true);
  });

  it('clears the flag once the row is synced', async () => {
    await cacheFarmList(OWNER, [farm()]);
    const row = await farmRepository.getByServerId(OWNER, 'srv-farm-1');
    await farmRepository.update(OWNER, row?.local_id ?? '', { name: 'Edited' });
    await farmRepository.markSynced(OWNER, row?.local_id ?? '', null);

    const cached = await readCachedFarmList(OWNER);
    expect(cached?.farms[0].pendingSync).toBe(false);
  });

  it('flags fields the same way', async () => {
    await cacheFarmList(OWNER, [farm()]);
    await cacheFieldList(OWNER, 'srv-farm-1', [field()]);

    const fromServer = await readCachedFieldList(OWNER, 'srv-farm-1');
    expect(fromServer?.[0].pendingSync).toBe(false);

    const farmRow = await farmRepository.getByServerId(OWNER, 'srv-farm-1');
    await fieldRepository.create(OWNER, {
      farm_local_id: farmRow?.local_id ?? '',
      name: 'Made offline',
    });

    const all = await readCachedFieldList(OWNER, 'srv-farm-1');
    const made = all?.find(f => f.name === 'Made offline');
    expect(made?.pendingSync).toBe(true);
  });
});

describe('local edits are protected from a server read', () => {
  it('does not clobber a farm the user changed offline', async () => {
    await cacheFarmList(OWNER, [farm()]);
    const row = await farmRepository.getByServerId(OWNER, 'srv-farm-1');
    await farmRepository.update(OWNER, row?.local_id ?? '', { name: 'My local name' });

    await cacheFarmList(OWNER, [farm({ name: 'Server name' })]);

    const after = await farmRepository.getByServerId(OWNER, 'srv-farm-1');
    expect(after?.name).toBe('My local name');
  });
});
