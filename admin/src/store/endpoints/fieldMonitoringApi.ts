import { apiSlice } from "../api";
import type {
  ApiSuccess,
  FieldModuleContext,
  ModuleSummary,
  ModuleRecord,
  ModuleDocument,
  ModuleKey,
  DocumentModule,
  DocumentKind,
  FarmProgram,
  FarmModuleRecord,
} from "../../types";

/**
 * Field monitoring modules.
 *
 * Every call names a program and a field, because a record only means
 * something as a combination of the two. The module is a path segment rather
 * than nine separate endpoints, matching the backend.
 */

const base = (programId: string, fieldId: string) =>
  `/field-monitoring/programs/${programId}/fields/${fieldId}`;

export interface FieldProgram {
  programId: string;
  fieldId: string;
}

export interface ModuleTarget extends FieldProgram {
  module: ModuleKey;
}

export interface RecordBody {
  [column: string]: unknown;
}

export const fieldMonitoringApi = apiSlice.injectEndpoints({
  endpoints: (build) => ({
    /**
     * Which programs this farm has fields enrolled in. Opening a farm starts
     * here, because a workbook is one farm inside one program.
     */
    getFarmPrograms: build.query<
      { farmName: string; programs: FarmProgram[] },
      string
    >({
      query: (farmId) => ({
        url: `/field-monitoring/farms/${farmId}/programs`,
        method: "GET",
      }),
      transformResponse: (
        res: ApiSuccess<{ farmName: string; programs: FarmProgram[] }>
      ) => res.data,
      providesTags: (_r, _e, farmId) => [
        { type: "FieldModules", id: `farm:${farmId}` },
      ],
    }),

    /** The nine modules for a whole farm, for one program. */
    getFarmModules: build.query<
      { farmName: string; modules: ModuleSummary[] },
      { farmId: string; programId: string }
    >({
      query: ({ farmId, programId }) => ({
        url: `/field-monitoring/farms/${farmId}/programs/${programId}/modules`,
        method: "GET",
      }),
      transformResponse: (
        res: ApiSuccess<{ farmName: string; modules: ModuleSummary[] }>
      ) => res.data,
      providesTags: (_r, _e, { farmId, programId }) => [
        { type: "FieldModules", id: `farm:${farmId}:${programId}` },
      ],
    }),

    /** One module across every field of a farm. */
    listFarmRecords: build.query<
      { farmName: string; records: FarmModuleRecord[] },
      { farmId: string; programId: string; module: ModuleKey }
    >({
      query: ({ farmId, programId, module }) => ({
        url: `/field-monitoring/farms/${farmId}/programs/${programId}/modules/${module}`,
        method: "GET",
      }),
      transformResponse: (
        res: ApiSuccess<{ farmName: string; records: FarmModuleRecord[] }>
      ) => res.data,
      providesTags: (_r, _e, { farmId, programId, module }) => [
        { type: "FieldModuleRecords", id: `farm:${farmId}:${programId}:${module}` },
      ],
    }),

    /** The nine-module list a field opens with, each with its counts. */
    getFieldModules: build.query<
      { context: FieldModuleContext; modules: ModuleSummary[] },
      FieldProgram
    >({
      query: ({ programId, fieldId }) => ({
        url: `${base(programId, fieldId)}/modules`,
        method: "GET",
      }),
      transformResponse: (
        res: ApiSuccess<{ context: FieldModuleContext; modules: ModuleSummary[] }>
      ) => res.data,
      providesTags: (_r, _e, { fieldId, programId }) => [
        { type: "FieldModules", id: `${programId}:${fieldId}` },
      ],
    }),

    listModuleRecords: build.query<
      { context: FieldModuleContext; records: ModuleRecord[] },
      ModuleTarget
    >({
      query: ({ programId, fieldId, module }) => ({
        url: `${base(programId, fieldId)}/modules/${module}`,
        method: "GET",
      }),
      transformResponse: (
        res: ApiSuccess<{ context: FieldModuleContext; records: ModuleRecord[] }>
      ) => res.data,
      providesTags: (_r, _e, { fieldId, programId, module }) => [
        { type: "FieldModuleRecords", id: `${programId}:${fieldId}:${module}` },
      ],
    }),

    createModuleRecord: build.mutation<
      ModuleRecord,
      ModuleTarget & { body: RecordBody }
    >({
      query: ({ programId, fieldId, module, body }) => ({
        url: `${base(programId, fieldId)}/modules/${module}`,
        method: "POST",
        data: body,
      }),
      transformResponse: (res: ApiSuccess<{ record: ModuleRecord }>) =>
        res.data.record,
      // The counts on the module list change too, so both are refreshed.
      invalidatesTags: (_r, _e, { fieldId, programId, module }) => [
        { type: "FieldModuleRecords", id: `${programId}:${fieldId}:${module}` },
        { type: "FieldModules", id: `${programId}:${fieldId}` },
      ],
    }),

    updateModuleRecord: build.mutation<
      ModuleRecord,
      ModuleTarget & { id: string; body: RecordBody }
    >({
      query: ({ programId, fieldId, module, id, body }) => ({
        url: `${base(programId, fieldId)}/modules/${module}/${id}`,
        method: "PATCH",
        data: body,
      }),
      transformResponse: (res: ApiSuccess<{ record: ModuleRecord }>) =>
        res.data.record,
      invalidatesTags: (_r, _e, { fieldId, programId, module }) => [
        { type: "FieldModuleRecords", id: `${programId}:${fieldId}:${module}` },
        { type: "FieldModules", id: `${programId}:${fieldId}` },
      ],
    }),

    deleteModuleRecord: build.mutation<void, ModuleTarget & { id: string }>({
      query: ({ programId, fieldId, module, id }) => ({
        url: `${base(programId, fieldId)}/modules/${module}/${id}`,
        method: "DELETE",
      }),
      // The row leaves the table at once and comes back if the server refuses.
      // Without this it sits there for the several seconds the refetch takes,
      // which reads as though the delete did nothing.
      async onQueryStarted(arg, { dispatch, queryFulfilled }) {
        const undo = dispatch(
          fieldMonitoringApi.util.updateQueryData(
            "listModuleRecords",
            { programId: arg.programId, fieldId: arg.fieldId, module: arg.module },
            (draft) => {
              draft.records = draft.records.filter((r) => r.id !== arg.id);
            }
          )
        );
        try {
          await queryFulfilled;
        } catch {
          undo.undo();
        }
      },
      // Deleting a record takes its files with it, so documents refresh too.
      invalidatesTags: (_r, _e, { fieldId, programId, module }) => [
        { type: "FieldModuleRecords", id: `${programId}:${fieldId}:${module}` },
        { type: "FieldModules", id: `${programId}:${fieldId}` },
        { type: "FieldModuleDocuments", id: `${programId}:${fieldId}` },
      ],
    }),

    listModuleDocuments: build.query<
      ModuleDocument[],
      FieldProgram & { module?: DocumentModule; recordId?: string }
    >({
      query: ({ programId, fieldId, module, recordId }) => ({
        url: `${base(programId, fieldId)}/documents`,
        method: "GET",
        params: { module, recordId },
      }),
      transformResponse: (res: ApiSuccess<{ documents: ModuleDocument[] }>) =>
        res.data.documents,
      providesTags: (_r, _e, { fieldId, programId }) => [
        { type: "FieldModuleDocuments", id: `${programId}:${fieldId}` },
      ],
    }),

    /**
     * The drag and drop box. The file goes up and the record is written in one
     * call; the name, type and size are read from the file by the server.
     */
    uploadModuleDocument: build.mutation<
      ModuleDocument,
      FieldProgram & {
        module: DocumentModule;
        recordId?: string | null;
        kind?: DocumentKind;
        file: File;
      }
    >({
      query: ({ programId, fieldId, module, recordId, kind, file }) => {
        const form = new FormData();
        form.append("module", module);
        if (recordId) form.append("recordId", recordId);
        if (kind) form.append("kind", kind);
        form.append("file", file);
        return {
          url: `${base(programId, fieldId)}/documents/upload`,
          method: "POST",
          data: form,
        };
      },
      transformResponse: (res: ApiSuccess<{ document: ModuleDocument }>) =>
        res.data.document,
      invalidatesTags: (_r, _e, { fieldId, programId, module }) => [
        { type: "FieldModuleDocuments", id: `${programId}:${fieldId}` },
        { type: "FieldModules", id: `${programId}:${fieldId}` },
        {
          type: "FieldModuleRecords",
          id: `${programId}:${fieldId}:${module}`,
        },
      ],
    }),

    deleteModuleDocument: build.mutation<
      void,
      FieldProgram & { documentId: string; module: DocumentModule }
    >({
      query: ({ programId, fieldId, documentId }) => ({
        url: `${base(programId, fieldId)}/documents/${documentId}`,
        method: "DELETE",
      }),
      invalidatesTags: (_r, _e, { fieldId, programId, module }) => [
        { type: "FieldModuleDocuments", id: `${programId}:${fieldId}` },
        { type: "FieldModules", id: `${programId}:${fieldId}` },
        {
          type: "FieldModuleRecords",
          id: `${programId}:${fieldId}:${module}`,
        },
      ],
    }),
  }),
});

export const {
  useGetFarmProgramsQuery,
  useLazyGetFarmProgramsQuery,
  useGetFarmModulesQuery,
  useListFarmRecordsQuery,
  useLazyListFarmRecordsQuery,
  useGetFieldModulesQuery,
  useListModuleRecordsQuery,
  useLazyListModuleRecordsQuery,
  useCreateModuleRecordMutation,
  useUpdateModuleRecordMutation,
  useDeleteModuleRecordMutation,
  useListModuleDocumentsQuery,
  useLazyListModuleDocumentsQuery,
  useUploadModuleDocumentMutation,
  useDeleteModuleDocumentMutation,
} = fieldMonitoringApi;
