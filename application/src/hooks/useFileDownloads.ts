import { useCallback, useEffect, useRef, useState } from 'react';
import {
  downloadDocument,
  getLocalPath,
  isDownloaded,
} from '../services/fileDownloadService';

export type DownloadStatus = 'idle' | 'checking' | 'downloading' | 'exists' | 'error';

export interface DownloadEntry {
  status: DownloadStatus;
  progress: number;
  localPath?: string;
}

interface DownloadableDoc {
  id: string;
  name: string;
  url: string;
}

export const DEFAULT_ENTRY: DownloadEntry = { status: 'idle', progress: 0 };

export interface UseFileDownloads {
  entries: Record<string, DownloadEntry>;
  download: (doc: DownloadableDoc) => Promise<boolean>;
}

export const useFileDownloads = (docs: DownloadableDoc[]): UseFileDownloads => {
  const [entries, setEntries] = useState<Record<string, DownloadEntry>>({});

  const entriesRef = useRef(entries);
  entriesRef.current = entries;
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const patch = useCallback((id: string, next: Partial<DownloadEntry>) => {
    if (!mounted.current) {
      return;
    }
    setEntries(prev => ({
      ...prev,
      [id]: { ...(prev[id] ?? DEFAULT_ENTRY), ...next },
    }));
  }, []);

  const idsKey = docs.map(d => d.id).join('|');
  useEffect(() => {
    let cancelled = false;
    Promise.all(
      docs.map(async doc => {
        if (entriesRef.current[doc.id]?.status === 'downloading') {
          return;
        }
        const exists = await isDownloaded(doc).catch(() => false);
        if (cancelled) {
          return;
        }
        patch(
          doc.id,
          exists
            ? { status: 'exists', progress: 1, localPath: getLocalPath(doc) }
            : { status: 'idle', progress: 0 },
        );
      }),
    );
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idsKey, patch]);

  const download = useCallback(
    async (doc: DownloadableDoc): Promise<boolean> => {
      patch(doc.id, { status: 'downloading', progress: 0 });
      try {
        const path = await downloadDocument(doc, fraction =>
          patch(doc.id, { progress: fraction }),
        );
        patch(doc.id, { status: 'exists', progress: 1, localPath: path });
        return true;
      } catch {
        patch(doc.id, { status: 'error' });
        return false;
      }
    },
    [patch],
  );

  return { entries, download };
};
