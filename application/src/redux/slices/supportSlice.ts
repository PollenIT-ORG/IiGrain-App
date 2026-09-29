import { createSlice } from '@reduxjs/toolkit';
import type { Faq } from '../../types/support';
import { fetchFaqsThunk, submitContactEnquiryThunk } from '../thunks/supportThunks';

export interface SupportState {
  faqs: Faq[];
  faqsLoaded: boolean;
  loadingFaqs: boolean;
  faqsError: string | null;
  faqsFetchedAt: number | null;
  submittingEnquiry: boolean;
}

const initialState: SupportState = {
  faqs: [],
  faqsLoaded: false,
  loadingFaqs: false,
  faqsError: null,
  faqsFetchedAt: null,
  submittingEnquiry: false,
};

const supportSlice = createSlice({
  name: 'support',
  initialState,
  reducers: {
    clearFaqsError(state) {
      state.faqsError = null;
    },
  },
  extraReducers: builder => {
    builder
      .addCase(fetchFaqsThunk.pending, state => {
        state.loadingFaqs = true;
        state.faqsError = null;
      })
      .addCase(fetchFaqsThunk.fulfilled, (state, action) => {
        state.loadingFaqs = false;
        state.faqs = action.payload;
        state.faqsLoaded = true;
        state.faqsFetchedAt = Date.now();
      })
      .addCase(fetchFaqsThunk.rejected, (state, action) => {
        state.loadingFaqs = false;
        state.faqsError = action.payload?.message ?? 'Could not load help topics';
      })
      .addCase(submitContactEnquiryThunk.pending, state => {
        state.submittingEnquiry = true;
      })
      .addCase(submitContactEnquiryThunk.fulfilled, state => {
        state.submittingEnquiry = false;
      })
      .addCase(submitContactEnquiryThunk.rejected, state => {
        state.submittingEnquiry = false;
      });
  },
});

export const { clearFaqsError } = supportSlice.actions;
export default supportSlice.reducer;

interface HasSupport {
  support: SupportState;
}

export const selectFaqs = (s: HasSupport): Faq[] => s.support.faqs;
export const selectFaqsLoaded = (s: HasSupport): boolean => s.support.faqsLoaded;
export const selectFaqsLoading = (s: HasSupport): boolean => s.support.loadingFaqs;
export const selectFaqsError = (s: HasSupport): string | null => s.support.faqsError;
export const selectSubmittingEnquiry = (s: HasSupport): boolean =>
  s.support.submittingEnquiry;
