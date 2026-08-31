import { useRef, useState } from "react";
import { showSuccess, showError } from "./toast";
import { MODULES } from "./fieldModules";
import { exportFarmWorkbook } from "./farmWorkbookExport";
import { yearOfRecord } from "./monitoringYear";
import {
  useLazyGetFarmFieldsQuery,
  useLazyListFarmRecordsQuery,
  useLazyListModuleDocumentsQuery,
} from "../store/endpoints/fieldMonitoringApi";
import type {
  ModuleKey,
  ModuleRecord,
  ModuleDocument,
  FarmModuleRecord,
} from "../types";

function errMsg(err: unknown): string {
  return (
    (err as { message?: string })?.message ??
    "Something went wrong. Please try again."
  );
}

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** A few requests at a time, so nine modules do not run one after the other. */
async function pool<T, R>(
  items: readonly T[],
  worker: (item: T) => Promise<R>,
  size = 6
): Promise<R[]> {
  const out = new Array<R>(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(size, items.length) }, async () => {
      while (next < items.length) {
        const i = next++;
        out[i] = await worker(items[i]);
      }
    })
  );
  return out;
}

export interface FarmWorkbookOptions {
  /** Which year to export. Left out, every record goes in. */
  year?: string;
  /** Shown in messages before the farm's real name has been fetched. */
  farmName?: string;
}

/**
 * Building a farm's workbook, in one place. Two screens offer this download:
 * the farmer's page and the farm's page.
 */
export function useFarmWorkbook() {
  const [busyFarmId, setBusyFarmId] = useState<string | null>(null);
  const [fetchFields] = useLazyGetFarmFieldsQuery();
  const [fetchRecords] = useLazyListFarmRecordsQuery();
  const [fetchDocs] = useLazyListModuleDocumentsQuery();

  // State lags a render behind, so a second press lands before the button is
  // disabled. This is checked where the second press actually arrives.
  const running = useRef(false);

  /** One farm, one file. Everything is gathered before the first byte is written. */
  async function build(
    farmId: string,
    options: FarmWorkbookOptions = {}
  ): Promise<number> {
    if (!UUID.test(farmId)) {
      showError("That farm could not be identified. Please reload the page.");
      return 0;
    }
    if (options.year && !/^\d{4}$/.test(options.year)) {
      showError("That year could not be identified. Please reload the page.");
      return 0;
    }

    const label = options.farmName ?? "This farm";
    const { farmName, fields } = await fetchFields(farmId, true).unwrap();
    if (!fields.length) {
      showError(`${farmName || label} has no fields yet.`);
      return 0;
    }

    const fetched = await pool(MODULES, async (def) => {
      const res = await fetchRecords({ farmId, module: def.key }, true).unwrap();
      return { module: def.key, records: res.records as FarmModuleRecord[] };
    });

    const byModule = {} as Record<
      ModuleKey,
      Array<ModuleRecord & { fieldName: string }>
    >;
    let total = 0;
    for (const got of fetched) {
      const rows = got.records
        .filter((r) => !options.year || yearOfRecord(r) === options.year)
        .map((r) => ({ ...r, fieldName: r.field_name }));
      byModule[got.module] = rows;
      total += rows.length;
    }

    if (total === 0) {
      showError(
        options.year
          ? `${farmName} has no monitoring records for ${options.year}.`
          : `${farmName} has no monitoring records yet, so there is nothing to export.`
      );
      return 0;
    }

    const docLists = await pool(fields, (f) =>
      fetchDocs({ fieldId: f.fieldId }, true).unwrap()
    );
    const documents: ModuleDocument[] = [];
    for (const list of docLists) documents.push(...list);

    await exportFarmWorkbook({
      farmName,
      year: options.year,
      fields,
      recordsByModule: byModule,
      documents,
    });
    return 1;
  }

  /** One farm. Guarded, so a double press is still one file. */
  async function download(
    farmId: string,
    options: FarmWorkbookOptions = {}
  ): Promise<number> {
    if (running.current) return 0;
    running.current = true;
    setBusyFarmId(farmId);
    try {
      const files = await build(farmId, options);
      if (files) showSuccess("Farm workbook downloaded.");
      return files;
    } catch (err) {
      showError(errMsg(err));
      return 0;
    } finally {
      running.current = false;
      setBusyFarmId(null);
    }
  }

  /** Every farm of one farmer, each as its own workbook. */
  async function downloadMany(
    farms: Array<{ id: string; name: string }>,
    options: FarmWorkbookOptions = {}
  ): Promise<number> {
    if (running.current) return 0;
    running.current = true;
    let files = 0;
    try {
      for (const farm of farms) {
        setBusyFarmId(farm.id);
        try {
          files += await build(farm.id, { ...options, farmName: farm.name });
        } catch (err) {
          // One farm failing should not cost the farmer the others.
          showError(`${farm.name}: ${errMsg(err)}`);
        }
      }
      if (files > 0) {
        showSuccess(
          files === 1
            ? "Farm workbook downloaded."
            : `${files} farm workbooks downloaded.`
        );
      }
      return files;
    } finally {
      running.current = false;
      setBusyFarmId(null);
    }
  }

  /** How many farms would actually produce a file, so the caller can say so. */
  async function countExportable(
    farms: Array<{ id: string; name: string }>
  ): Promise<number> {
    let ready = 0;
    for (const farm of farms) {
      if (!UUID.test(farm.id)) continue;
      try {
        const { fields } = await fetchFields(farm.id, true).unwrap();
        if (fields.length) ready++;
      } catch {
        // Counting is a courtesy; the download itself reports the real error.
      }
    }
    return ready;
  }

  return { download, downloadMany, countExportable, busyFarmId };
}
