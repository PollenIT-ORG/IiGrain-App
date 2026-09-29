import { createAsyncThunk } from '@reduxjs/toolkit';
import * as fieldDetailsApi from '../../api/fieldDetailsApi';
import type { ActivityEntry } from '../../types/farm';
import type { FieldDocument, FieldOverview, FieldSoil } from '../../types/fieldDetails';
import { handleApiError, StandardizedError } from '../../utils/handleApiError';
import { asOwnerUserId, isDatabaseReady } from '../../services/db';
import type { OwnerUserId } from '../../services/db/types';
import {
  cacheFieldDocuments,
  fieldScope,
  readCachedFieldDocuments,
} from '../../services/sync/documentCache';
import { throughOfflineSnapshot as throughSnapshot } from '../../services/sync/offlineSnapshot';

type ThunkConfig = { rejectValue: StandardizedError };

interface AuthStateSlice {
  auth?: { user?: { id?: string } | null } | null;
}

const ownerFrom = (getState: () => unknown): OwnerUserId | null => {
  if (!isDatabaseReady()) {
    return null;
  }
  const userId = (getState() as AuthStateSlice).auth?.user?.id;
  return userId ? asOwnerUserId(userId) : null;
};

const isOffline = (error: unknown): boolean =>
  handleApiError(error).kind === 'offline';

export const fetchFieldOverviewThunk = createAsyncThunk<
  FieldOverview,
  string,
  ThunkConfig
>('fieldDetails/overview', async (fieldId, { getState, rejectWithValue }) => {
  try {
    return await throughSnapshot(
      ownerFrom(getState),
      fieldScope(fieldId, 'overview'),
      () => fieldDetailsApi.getFieldOverview(fieldId),
    );
  } catch (error) {
    return rejectWithValue(handleApiError(error));
  }
});

export const fetchFieldActivityThunk = createAsyncThunk<
  ActivityEntry[],
  string,
  ThunkConfig
>('fieldDetails/activity', async (fieldId, { getState, rejectWithValue }) => {
  try {
    return await throughSnapshot(
      ownerFrom(getState),
      fieldScope(fieldId, 'activity'),
      () => fieldDetailsApi.getFieldActivity(fieldId),
    );
  } catch (error) {
    return rejectWithValue(handleApiError(error));
  }
});

export const fetchFieldSoilThunk = createAsyncThunk<FieldSoil, string, ThunkConfig>(
  'fieldDetails/soil',
  async (fieldId, { getState, rejectWithValue }) => {
    try {
      return await throughSnapshot(
        ownerFrom(getState),
        fieldScope(fieldId, 'soil'),
        () => fieldDetailsApi.getFieldSoil(fieldId),
      );
    } catch (error) {
      return rejectWithValue(handleApiError(error));
    }
  },
);

export const fetchFieldDocumentsThunk = createAsyncThunk<
  FieldDocument[],
  string,
  ThunkConfig
>('fieldDetails/documents', async (fieldId, { getState, rejectWithValue }) => {
  const owner = ownerFrom(getState);
  try {
    const documents = await fieldDetailsApi.getFieldDocuments(fieldId);
    if (owner) {
      await cacheFieldDocuments(owner, fieldId, documents).catch(() => undefined);
    }
    return documents;
  } catch (error) {
    if (owner && isOffline(error)) {
      const cached = await readCachedFieldDocuments(owner, fieldId).catch(() => null);
      if (cached) {
        return cached;
      }
    }
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
