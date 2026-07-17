import {
  pick,
  keepLocalCopy,
  types,
  errorCodes,
  isErrorWithCode,
} from '@react-native-documents/picker';

export interface PickedDocument {
  uri: string;
  name: string;
  mime: string;
  size: number | null;
}

export interface PickDocumentOptions {
  pdfOnly?: boolean;
}

export const pickDocument = async (
  options?: PickDocumentOptions,
): Promise<PickedDocument | null> => {
  try {
    const [file] = await pick({
      type: options?.pdfOnly
        ? [types.pdf]
        : [
            types.pdf,
            types.images,
            types.doc,
            types.docx,
            types.xls,
            types.xlsx,
            types.plainText,
            types.csv,
          ],
    });

    const fileName = file.name ?? 'document';

    const [copy] = await keepLocalCopy({
      files: [{ uri: file.uri, fileName }],
      destination: 'cachesDirectory',
    });

    const uri = copy.status === 'success' ? copy.localUri : file.uri;

    return {
      uri,
      name: fileName,
      mime: file.type ?? 'application/octet-stream',
      size: file.size ?? null,
    };
  } catch (err) {
    if (isErrorWithCode(err) && err.code === errorCodes.OPERATION_CANCELED) {
      return null;
    }
    throw err;
  }
};
