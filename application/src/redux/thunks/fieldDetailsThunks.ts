import { createAsyncThunk } from '@reduxjs/toolkit';
import * as fieldDetailsApi from '../../api/fieldDetailsApi';
import type { ActivityEntry } from '../../types/farm';
import type { FieldDocument, FieldOverview, FieldSoil } from '../../types/fieldDetails';
import { handleApiError, StandardizedError } from '../../utils/handleApiError';

type ThunkConfig = { rejectValue: StandardizedError };

export const fetchFieldOverviewThunk = createAsyncThunk<
  FieldOverview,
  string,
  ThunkConfig
>('fieldDetails/overview', async (fieldId, { rejectWithValue }) => {
  try {
    return await fieldDetailsApi.getFieldOverview(fieldId);
  } catch (error) {
    return rejectWithValue(handleApiError(error));
  }
});

export const fetchFieldActivityThunk = createAsyncThunk<
  ActivityEntry[],
  string,
  ThunkConfig
>('fieldDetails/activity', async (fieldId, { rejectWithValue }) => {
  try {
    return await fieldDetailsApi.getFieldActivity(fieldId);
  } catch (error) {
    return rejectWithValue(handleApiError(error));
  }
});

export const fetchFieldSoilThunk = createAsyncThunk<FieldSoil, string, ThunkConfig>(
  'fieldDetails/soil',
  async (fieldId, { rejectWithValue }) => {
    try {
      return await fieldDetailsApi.getFieldSoil(fieldId);
    } catch (error) {
      return rejectWithValue(handleApiError(error));
    }
  },
);

export const fetchFieldDocumentsThunk = createAsyncThunk<
  FieldDocument[],
  string,
  ThunkConfig
>('fieldDetails/documents', async (fieldId, { rejectWithValue }) => {
  try {
    return await fieldDetailsApi.getFieldDocuments(fieldId);
  } catch (error) {
    return rejectWithValue(handleApiError(error));
  }
});

export interface UploadDocumentArg {
  fieldId: string;
  file: fieldDetailsApi.DocumentUploadFile;
  name: string;
}

export const uploadFieldDocumentThunk = createAsyncThunk<
  FieldDocument,
  UploadDocumentArg,
  ThunkConfig
>('fieldDetails/uploadDocument', async ({ fieldId, file, name }, { rejectWithValue }) => {
  try {
    return await fieldDetailsApi.uploadFieldDocument(fieldId, file, name);
  } catch (error) {
    return rejectWithValue(handleApiError(error));
  }
});

export interface DeleteDocumentArg {
  fieldId: string;
  documentId: string;
}

export const deleteFieldDocumentThunk = createAsyncThunk<
  string,
  DeleteDocumentArg,
  ThunkConfig
>('fieldDetails/deleteDocument', async ({ fieldId, documentId }, { rejectWithValue }) => {
  try {
    return await fieldDetailsApi.deleteFieldDocument(fieldId, documentId);
  } catch (error) {
    return rejectWithValue(handleApiError(error));
  }
});
