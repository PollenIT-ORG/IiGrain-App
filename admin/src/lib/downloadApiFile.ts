import api from "./api";
import { blobErrorMessage } from "./openPdf";
import { showError } from "./toast";

/** Saves a file from an authenticated API path; a plain link cannot carry the access token. */
export async function downloadApiFile(path: string, filename: string): Promise<void> {
  try {
    const { data } = await api.get<Blob>(path, { responseType: "blob" });
    const url = URL.createObjectURL(data);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
  } catch (error) {
    showError(await blobErrorMessage(error));
  }
}
