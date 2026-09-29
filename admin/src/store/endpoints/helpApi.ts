import { apiSlice } from "../api";
import type {
  ApiPaged,
  ApiSuccess,
  ContactEnquiry,
  ContactEnquiryReply,
  Faq,
  PageMeta,
} from "../../types";

// One enquiry with everything the office has already sent back about it.
export interface EnquiryDetail {
  enquiry: ContactEnquiry;
  replies: ContactEnquiryReply[];
}

export interface ReplyInput {
  subject: string;
  message: string;
  resolve?: boolean;
}

interface FaqListArgs {
  page?: number;
  limit?: number;
  status?: "active" | "inactive";
  search?: string;
}

interface EnquiryListArgs {
  page?: number;
  limit?: number;
  status?: "read" | "unread" | "resolved" | "open";
  search?: string;
}

export interface FaqInput {
  question: string;
  answer: string;
  sortOrder?: number;
  isActive?: boolean;
}

export const helpApi = apiSlice.injectEndpoints({
  endpoints: (build) => ({
    // The panel list, which includes the switched-off entries.
    listFaqs: build.query<{ faqs: Faq[]; meta: PageMeta }, FaqListArgs>({
      query: (params) => ({ url: "/faqs/manage", method: "GET", params }),
      transformResponse: (res: ApiPaged<{ faqs: Faq[] }>) => ({
        faqs: res.data.faqs,
        meta: res.meta,
      }),
      providesTags: ["Faqs"],
    }),

    createFaq: build.mutation<Faq, FaqInput>({
      query: (body) => ({ url: "/faqs", method: "POST", data: body }),
      transformResponse: (res: ApiSuccess<{ faq: Faq }>) => res.data.faq,
      invalidatesTags: ["Faqs"],
    }),

    updateFaq: build.mutation<Faq, { id: string; body: Partial<FaqInput> }>({
      query: ({ id, body }) => ({ url: `/faqs/${id}`, method: "PATCH", data: body }),
      transformResponse: (res: ApiSuccess<{ faq: Faq }>) => res.data.faq,
      invalidatesTags: ["Faqs"],
    }),

    deleteFaq: build.mutation<void, string>({
      query: (id) => ({ url: `/faqs/${id}`, method: "DELETE" }),
      invalidatesTags: ["Faqs"],
    }),

    // The whole list goes back in its new order after a move.
    reorderFaqs: build.mutation<void, Array<{ id: string; sortOrder: number }>>({
      query: (items) => ({ url: "/faqs/reorder", method: "PATCH", data: { items } }),
      invalidatesTags: ["Faqs"],
    }),

    listEnquiries: build.query<
      { enquiries: ContactEnquiry[]; unread: number; open: number; meta: PageMeta },
      EnquiryListArgs
    >({
      query: (params) => ({ url: "/contact-enquiries", method: "GET", params }),
      transformResponse: (
        res: ApiPaged<{ enquiries: ContactEnquiry[]; unread: number; open: number }>
      ) => ({
        enquiries: res.data.enquiries,
        unread: res.data.unread,
        open: res.data.open,
        meta: res.meta,
      }),
      providesTags: ["ContactEnquiries"],
    }),

    // Reading one is what marks it read, so the list has to refetch after.
    getEnquiry: build.query<EnquiryDetail, string>({
      query: (id) => ({ url: `/contact-enquiries/${id}`, method: "GET" }),
      transformResponse: (res: ApiSuccess<EnquiryDetail>) => res.data,
      providesTags: ["ContactEnquiries"],
    }),

    // Sends the email and records it. The list badge changes with it, so the
    // same tag is invalidated.
    replyToEnquiry: build.mutation<
      { enquiry: ContactEnquiry; reply: ContactEnquiryReply },
      { id: string; body: ReplyInput }
    >({
      query: ({ id, body }) => ({
        url: `/contact-enquiries/${id}/reply`,
        method: "POST",
        data: body,
      }),
      transformResponse: (
        res: ApiSuccess<{ enquiry: ContactEnquiry; reply: ContactEnquiryReply }>
      ) => res.data,
      invalidatesTags: ["ContactEnquiries"],
    }),

    // The same email, rendered by the same template but not sent.
    previewEnquiryReply: build.mutation<
      { subject: string; html: string },
      { id: string; body: ReplyInput }
    >({
      query: ({ id, body }) => ({
        url: `/contact-enquiries/${id}/reply/preview`,
        method: "POST",
        data: body,
      }),
      transformResponse: (res: ApiSuccess<{ subject: string; html: string }>) =>
        res.data,
    }),

    setEnquiryRead: build.mutation<ContactEnquiry, { id: string; isRead: boolean }>({
      query: ({ id, isRead }) => ({
        url: `/contact-enquiries/${id}/read`,
        method: "PATCH",
        data: { isRead },
      }),
      transformResponse: (res: ApiSuccess<{ enquiry: ContactEnquiry }>) =>
        res.data.enquiry,
      invalidatesTags: ["ContactEnquiries"],
    }),

    setEnquiryResolved: build.mutation<ContactEnquiry, { id: string; isResolved: boolean }>({
      query: ({ id, isResolved }) => ({
        url: `/contact-enquiries/${id}/resolve`,
        method: "PATCH",
        data: { isResolved },
      }),
      transformResponse: (res: ApiSuccess<{ enquiry: ContactEnquiry }>) =>
        res.data.enquiry,
      invalidatesTags: ["ContactEnquiries"],
    }),

    bulkDeleteEnquiries: build.mutation<{ removed: number }, string[]>({
      query: (ids) => ({
        url: "/contact-enquiries/bulk-delete",
        method: "POST",
        data: { ids },
      }),
      transformResponse: (res: ApiSuccess<{ removed: number }>) => res.data,
      invalidatesTags: ["ContactEnquiries"],
    }),

    deleteEnquiry: build.mutation<void, string>({
      query: (id) => ({ url: `/contact-enquiries/${id}`, method: "DELETE" }),
      invalidatesTags: ["ContactEnquiries"],
    }),
  }),
});

export const {
  useListFaqsQuery,
  useCreateFaqMutation,
  useUpdateFaqMutation,
  useDeleteFaqMutation,
  useReorderFaqsMutation,
  useListEnquiriesQuery,
  useGetEnquiryQuery,
  useSetEnquiryReadMutation,
  useSetEnquiryResolvedMutation,
  useReplyToEnquiryMutation,
  usePreviewEnquiryReplyMutation,
  useBulkDeleteEnquiriesMutation,
  useDeleteEnquiryMutation,
} = helpApi;
