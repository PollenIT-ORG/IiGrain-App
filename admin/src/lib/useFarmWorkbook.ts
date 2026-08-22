import { useState } from "react";
import { showSuccess, showError } from "./toast";
import { MODULES } from "./fieldModules";
import { exportFarmWorkbook } from "./farmWorkbookExport";
import {
  useLazyGetFarmProgramsQuery,
  useLazyListFarmRecordsQuery,
  useLazyListModuleDocumentsQuery,
} from "../store/endpoints/fieldMonitoringApi";
import type { ModuleKey, ModuleRecord } from "../types";

function errMsg(err: unknown): string {
  return (
    (err as { message?: string })?.message ??
    "Something went wrong. Please try again."
  );
}

/**
 * Building a farm's workbook, in one place.
 *
 * Three screens offer this download: the farmer's page, the farm's page, and
 * the enrolled farmers list. Written out three times they would drift, so the
 * fetching and the file live here and each screen only says which farm.
 *
 * Records come from the farm-wide endpoint rather than field by field, so a
 * farm with a dozen fields is nine calls, not a hundred.
 */
export function useFarmWorkbook() {
  const [busyFarmId, setBusyFarmId] = useState<string | null>(null);
  const [fetchPrograms] = useLazyGetFarmProgramsQuery();
  const [fetchRecords] = useLazyListFarmRecordsQuery();
  const [fetchDocs] = useLazyListModuleDocumentsQuery();

  /**
   * One workbook per program the farm is enrolled in, since the client's own
   * file is one farm for one year and cannot hold two.
   */
  async function download(farmId: string, farmNameHint?: string) {
    setBusyFarmId(farmId);
    try {
      const { farmName, programs } = await fetchPrograms(farmId, true).unwrap();
      if (!programs.length) {
        showError(
          `${farmNameHint ?? farmName} has no fields enrolled in a program yet.`
        );
        return 0;
      }

      for (const program of programs) {
        const byModule = {} as Record<
          ModuleKey,
          Array<ModuleRecord & { fieldName: string }>
        >;
        for (const def of MODULES) {
          const res = await fetchRecords(
            { farmId, programId: program.programId, module: def.key },
            true
          ).unwrap();
          byModule[def.key] = res.records.map((r) => ({
            ...r,
            fieldName: r.field_name,
          }));
        }

        // Files are still held per field, so they are gathered per field.
        const documents = [];
        for (const f of program.fields) {
          const docs = await fetchDocs(
            { programId: program.programId, fieldId: f.fieldId },
            true
          ).unwrap();
          documents.push(...docs);
        }

        await exportFarmWorkbook({
          farmName,
          programName: program.programName,
          year: (program.startDate ?? new Date().toISOString()).slice(0, 4),
          fields: program.fields,
          recordsByModule: byModule,
          documents,
        });
      }

      showSuccess(
        programs.length === 1
          ? "Farm workbook downloaded."
          : `${programs.length} workbooks downloaded, one per program.`
      );
      return programs.length;
    } catch (err) {
      showError(errMsg(err));
      return 0;
    } finally {
      setBusyFarmId(null);
    }
  }

  /** Every farm of one farmer, each as its own workbook. */
  async function downloadMany(farms: Array<{ id: string; name: string }>) {
    let files = 0;
    for (const farm of farms) files += await download(farm.id, farm.name);
    if (files === 0) {
      showError("None of these farms have fields enrolled in a program yet.");
    }
    return files;
  }

  return { download, downloadMany, busyFarmId };
}
