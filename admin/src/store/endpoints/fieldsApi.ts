import { apiSlice } from "../api";
import type {
  Field,
  FieldSoil,
  FieldDocument,
  FieldHistoryEvent,
  AssessmentComparison,
  PageMeta,
  GeoJSONPolygon,
} from "../../types";

interface ListFieldsParams {
  page?: number;
  limit?: number;
  farmId?: string;
  ownerId?: string;
  hasBoundary?: boolean;
  isActive?: boolean;
  search?: string;
}

interface CreateFieldBody {
  farmId: string;
  name: string;
  areaAcres?: number;
  crop?: string;
  season?: string;
  irrigation?: string;
  location?: string;
  latitude?: number | null;
  longitude?: number | null;
  sowingDate?: string;
  expectedHarvest?: string;
  isActive?: boolean;
  /** Left out keeps the stored outline; null clears it. */
  boundary?: GeoJSONPolygon | null;
}

type UpdateFieldBody = Partial<Omit<CreateFieldBody, "farmId">>;

export interface SoilBody {
  ph?: number | null;
  organicMatter?: number | null;
  nitrogen?: number | null;
  phosphorus?: number | null;
  potassium?: number | null;
  moisture?: number | null;
  texture?: string | null;
  notes?: string | null;
  testedOn?: string | null;
}

export const fieldsApi = apiSlice.injectEndpoints({
  endpoints: (build) => ({
    listFields: build.query<
      { fields: Field[]; meta: PageMeta },
      ListFieldsParams
    >({
      query: (params) => ({ url: "/fields", params }),
      transformResponse: (r: { data: { fields: Field[]; meta: PageMeta } }) =>
        r.data,
      providesTags: ["Fields"],
    }),

    getField: build.query<Field, string>({
      query: (id) => ({ url: `/fields/${id}` }),
      transformResponse: (r: { data: { field: Field } }) => r.data.field,
      providesTags: (_r, _e, id) => [{ type: "Field", id }],
    }),

    createField: build.mutation<Field, CreateFieldBody>({
      query: (body) => ({ url: "/fields", method: "POST", data: body }),
      transformResponse: (r: { data: { field: Field } }) => r.data.field,
      invalidatesTags: ["Fields"],
    }),

    updateField: build.mutation<Field, { id: string; body: UpdateFieldBody }>({
      query: ({ id, body }) => ({
        url: `/fields/${id}`,
        method: "PATCH",
        data: body,
      }),
      transformResponse: (r: { data: { field: Field } }) => r.data.field,
      invalidatesTags: (_r, _e, { id }) => ["Fields", { type: "Field", id }],
    }),

    deleteField: build.mutation<void, string>({
      query: (id) => ({ url: `/fields/${id}`, method: "DELETE" }),
      invalidatesTags: ["Fields"],
    }),

    resetField: build.mutation<Field, string>({
      query: (id) => ({ url: `/fields/${id}/reset`, method: "POST" }),
      transformResponse: (r: { data: { field: Field } }) => r.data.field,
      invalidatesTags: (_r, _e, id) => [
        "Fields",
        { type: "Field", id },
        { type: "FieldSoil", id },
        { type: "FieldDocuments", id },
        { type: "FieldHistory", id },
      ],
    }),

    getFieldHistory: build.query<FieldHistoryEvent[], string>({
      query: (id) => ({ url: `/fields/${id}/details`, params: { tab: "history" } }),
      transformResponse: (r: { data: { history: FieldHistoryEvent[] } }) =>
        r.data.history ?? [],
      providesTags: (_r, _e, id) => [{ type: "FieldHistory", id }],
    }),

    getFieldSoil: build.query<FieldSoil | null, string>({
      query: (id) => ({ url: `/fields/${id}/soil` }),
      transformResponse: (r: { data: { soil: FieldSoil | null } }) =>
        r.data.soil,
      providesTags: (_r, _e, id) => [{ type: "FieldSoil", id }],
    }),

    saveFieldSoil: build.mutation<FieldSoil, { id: string; body: SoilBody }>({
      query: ({ id, body }) => ({
        url: `/fields/${id}/soil`,
        method: "PUT",
        data: body,
      }),
      transformResponse: (r: { data: { soil: FieldSoil } }) => r.data.soil,
      invalidatesTags: (_r, _e, { id }) => [
        { type: "FieldSoil", id },
        { type: "FieldHistory", id },
      ],
    }),

    getFieldDocuments: build.query<FieldDocument[], string>({
      query: (id) => ({ url: `/fields/${id}/documents` }),
      transformResponse: (r: { data: { documents: FieldDocument[] } }) =>
        r.data.documents ?? [],
      providesTags: (_r, _e, id) => [{ type: "FieldDocuments", id }],
    }),

    getAssessmentComparison: build.query<AssessmentComparison, string>({
      query: (id) => ({ url: `/fields/${id}/assessment-comparison` }),
      transformResponse: (r: { data: AssessmentComparison }) => r.data,
      providesTags: (_r, _e, id) => [{ type: "Field", id }],
    }),
  }),
});

export const {
  useListFieldsQuery,
  useGetFieldQuery,
  useCreateFieldMutation,
  useUpdateFieldMutation,
  useDeleteFieldMutation,
  useResetFieldMutation,
  useGetFieldHistoryQuery,
  useGetFieldSoilQuery,
  useSaveFieldSoilMutation,
  useGetFieldDocumentsQuery,
  useGetAssessmentComparisonQuery,
} = fieldsApi;
