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
  FarmField,
  FarmModuleRecord,
} from "../../types";

/** Field monitoring modules. A record belongs to a field and nothing else. */

const base = (fieldId: string) => `/field-monitoring/fields/${fieldId}`;

export interface ModuleTarget {
  fieldId: string;
  module: ModuleKey;
}

export interface RecordBody {
  [column: string]: unknown;
}

export const fieldMonitoringApi = apiSlice.injectEndpoints({
  endpoints: (build) => ({
    /** Every field of a farm, which is what a workbook is built from. */
    getFarmFields: build.query<{ farmName: string; fields: FarmField[] }, string>({
      query: (farmId) => ({
        url: `/field-monitoring/farms/${farmId}/fields`,
        method: "GET",
      }),
      transformResponse: (
        res: ApiSuccess<{ farmName: string; fields: FarmField[] }>
      ) => res.data,
      providesTags: (_r, _e, farmId) => [
        { type: "FieldModules", id: `farm:${farmId}` },
      ],
    }),

    /** The nine modules for a whole farm. */
    getFarmModules: build.query<
      { farmName: string; years: string[]; modules: ModuleSummary[] },
      string
    >({
      query: (farmId) => ({
        url: `/field-monitoring/farms/${farmId}/modules`,
        method: "GET",
      }),
      transformResponse: (
        res: ApiSuccess<{
          farmName: string;
          years: string[];
          modules: ModuleSummary[];
        }>
      ) => res.data,
      providesTags: (_r, _e, farmId) => [
        { type: "FieldModules", id: `farm:${farmId}:modules` },
      ],
    }),

    /** One module across every field of a farm. */
    listFarmRecords: build.query<
      { farmName: string; records: FarmModuleRecord[] },
      { farmId: string; module: ModuleKey }
    >({
      query: ({ farmId, module }) => ({
        url: `/field-monitoring/farms/${farmId}/modules/${module}`,
        method: "GET",
      }),
      transformResponse: (
        res: ApiSuccess<{ farmName: string; records: FarmModuleRecord[] }>
      ) => res.data,
      providesTags: (_r, _e, { farmId, module }) => [
        { type: "FieldModuleRecords", id: `farm:${farmId}:${module}` },
      ],
    }),

    /** The nine-module list a field opens with, each with its counts. */
    getFieldModules: build.query<
      { context: FieldModuleContext; modules: ModuleSummary[] },
      string
    >({
      query: (fieldId) => ({ url: `${base(fieldId)}/modules`, method: "GET" }),
      transformResponse: (
        res: ApiSuccess<{ context: FieldModuleContext; modules: ModuleSummary[] }>
      ) => res.data,
      providesTags: (_r, _e, fieldId) => [
        { type: "FieldModules", id: fieldId },
      ],
    }),

    listModuleRecords: build.query<
      { context: FieldModuleContext; records: ModuleRecord[] },
      ModuleTarget
    >({
      query: ({ fieldId, module }) => ({
        url: `${base(fieldId)}/modules/${module}`,
        method: "GET",
      }),
      transformResponse: (
        res: ApiSuccess<{ context: FieldModuleContext; records: ModuleRecord[] }>
      ) => res.data,
      providesTags: (_r, _e, { fieldId, module }) => [
        { type: "FieldModuleRecords", id: `${fieldId}:${module}` },
      ],
    }),

    createModuleRecord: build.mutation<
      ModuleRecord,
      ModuleTarget & { body: RecordBody }
    >({
      query: ({ fieldId, module, body }) => ({
        url: `${base(fieldId)}/modules/${module}`,
        method: "POST",
        data: body,
      }),
      transformResponse: (res: ApiSuccess<{ record: ModuleRecord }>) =>
        res.data.record,
      // The counts on the module list change too, so both are refreshed.
      invalidatesTags: (_r, _e, { fieldId, module }) => [
        { type: "FieldModuleRecords", id: `${fieldId}:${module}` },
        { type: "FieldModules", id: fieldId },
      ],
    }),

    updateModuleRecord: build.mutation<
      ModuleRecord,
      ModuleTarget & { id: string; body: RecordBody }
    >({
      query: ({ fieldId, module, id, body }) => ({
        url: `${base(fieldId)}/modules/${module}/${id}`,
        method: "PATCH",
        data: body,
      }),
      transformResponse: (res: ApiSuccess<{ record: ModuleRecord }>) =>
        res.data.record,
      invalidatesTags: (_r, _e, { fieldId, module }) => [
        { type: "FieldModuleRecords", id: `${fieldId}:${module}` },
        { type: "FieldModules", id: fieldId },
      ],
    }),

    deleteModuleRecord: build.mutation<void, ModuleTarget & { id: string }>({
      query: ({ fieldId, module, id }) => ({
        url: `${base(fieldId)}/modules/${module}/${id}`,
        method: "DELETE",
      }),
      // The row leaves the table at once and comes back if the server refuses,
      // otherwise it sits there for the seconds the refetch takes.
      async onQueryStarted(arg, { dispatch, queryFulfilled }) {
        const undo = dispatch(
          fieldMonitoringApi.util.updateQueryData(
            "listModuleRecords",
            { fieldId: arg.fieldId, module: arg.module },
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
      invalidatesTags: (_r, _e, { fieldId, module }) => [
        { type: "FieldModuleRecords", id: `${fieldId}:${module}` },
        { type: "FieldModules", id: fieldId },
        { type: "FieldModuleDocuments", id: fieldId },
      ],
    }),

    listModuleDocuments: build.query<
      ModuleDocument[],
      { fieldId: string; module?: DocumentModule; recordId?: string }
    >({
      query: ({ fieldId, module, recordId }) => ({
        url: `${base(fieldId)}/documents`,
        method: "GET",
        params: { module, recordId },
      }),
      transformResponse: (res: ApiSuccess<{ documents: ModuleDocument[] }>) =>
        res.data.documents,
      providesTags: (_r, _e, { fieldId }) => [
        { type: "FieldModuleDocuments", id: fieldId },
      ],
    }),

    /**
     * The drag and drop box. The file goes up and the record is written in one
     * call; the name, type and size are read from the file by the server.
     */
    uploadModuleDocument: build.mutation<
      ModuleDocument,
      {
        fieldId: string;
        module: DocumentModule;
        recordId?: string | null;
        kind?: DocumentKind;
        file: File;
      }
    >({
      query: ({ fieldId, module, recordId, kind, file }) => {
        const form = new FormData();
        form.append("module", module);
        if (recordId) form.append("recordId", recordId);
        if (kind) form.append("kind", kind);
        form.append("file", file);
        return {
          url: `${base(fieldId)}/documents/upload`,
          method: "POST",
          data: form,
        };
      },
      transformResponse: (res: ApiSuccess<{ document: ModuleDocument }>) =>
        res.data.document,
      invalidatesTags: (_r, _e, { fieldId, module }) => [
        { type: "FieldModuleDocuments", id: fieldId },
        { type: "FieldModules", id: fieldId },
        { type: "FieldModuleRecords", id: `${fieldId}:${module}` },
      ],
    }),

    deleteModuleDocument: build.mutation<
      void,
      { fieldId: string; documentId: string; module: DocumentModule }
    >({
      query: ({ fieldId, documentId }) => ({
        url: `${base(fieldId)}/documents/${documentId}`,
        method: "DELETE",
      }),
      invalidatesTags: (_r, _e, { fieldId, module }) => [
        { type: "FieldModuleDocuments", id: fieldId },
        { type: "FieldModules", id: fieldId },
        { type: "FieldModuleRecords", id: `${fieldId}:${module}` },
      ],
    }),
  }),
});

export const {
  useGetFarmFieldsQuery,
  useLazyGetFarmFieldsQuery,
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
