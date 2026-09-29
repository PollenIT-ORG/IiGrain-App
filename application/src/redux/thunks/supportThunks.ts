import { createAsyncThunk } from '@reduxjs/toolkit';
import * as supportApi from '../../api/supportApi';
import type {
  ContactEnquiryInput,
  ContactEnquiryResult,
  ContactFieldErrors,
  Faq,
} from '../../types/support';
import { handleApiError, StandardizedError } from '../../utils/handleApiError';

export interface ContactSubmitError extends StandardizedError {
  fieldErrors: ContactFieldErrors;
}

export const fetchFaqsThunk = createAsyncThunk<
  Faq[],
  void,
  { rejectValue: StandardizedError }
>('support/fetchFaqs', async (_, { rejectWithValue }) => {
  try {
    return await supportApi.getFaqs();
  } catch (error) {
    return rejectWithValue(handleApiError(error));
  }
});

export const submitContactEnquiryThunk = createAsyncThunk<
  ContactEnquiryResult,
  ContactEnquiryInput,
  { rejectValue: ContactSubmitError }
>('support/submitContactEnquiry', async (input, { rejectWithValue }) => {
  try {
    return await supportApi.submitContactEnquiry(input);
  } catch (error) {
    return rejectWithValue({
      ...handleApiError(error),
      fieldErrors: supportApi.contactFieldErrorsFor(error),
    });
  }
});
