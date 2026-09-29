import axios from "axios";
import api, { getApiErrorMessage } from "./api";
import { showError } from "./toast";

// PDFs served by the API sit behind the access token, and a plain link cannot
// carry that token. So the file is fetched with the API client and shown from a
// blob URL instead.

/** Turns a failed blob request back into a readable message. */
export async function blobErrorMessage(error: unknown): Promise<string> {
  if (axios.isAxiosError(error) && error.response?.data instanceof Blob) {
    try {
      const parsed = JSON.parse(await error.response.data.text()) as {
        message?: string;
        errors?: { message: string }[];
      };
      if (parsed.errors?.length) return parsed.errors[0].message;
      if (parsed.message) return parsed.message;
    } catch {
      // Not JSON: fall through to the generic message.
    }
  }
  return getApiErrorMessage(error);
}

/**
 * Reads a PDF from an authenticated API path, for drawing it on the page
 * rather than handing it to the browser's own viewer.
 *
 * @param path API path, e.g. `/program-admin-surveys/contracts/<id>/pdf`
 */
export async function fetchApiPdf(path: string): Promise<Uint8Array> {
  try {
    const { data } = await api.get<Blob>(path, { responseType: "blob" });
    return new Uint8Array(await data.arrayBuffer());
  } catch (error) {
    throw new Error(await blobErrorMessage(error));
  }
}

/**
 * Opens a PDF from an authenticated API path in a new tab.
 *
 * @param path     API path, e.g. `/program-admin-surveys/contracts/<id>/pdf`
 * @param filename Name used if the browser downloads it instead of showing it
 */
export async function openApiPdf(
  path: string,
  filename = "document.pdf"
): Promise<void> {
  // Opened straight away so the browser still counts it as part of the click.
  const tab = window.open("", "_blank");
  try {
    const { data } = await api.get<Blob>(path, { responseType: "blob" });
    const url = URL.createObjectURL(new Blob([data], { type: "application/pdf" }));
    if (tab) {
      tab.location.href = url;
    } else {
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      link.click();
    }
    // Kept alive long enough for the tab to load it.
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
  } catch (error) {
    tab?.close();
    showError(await blobErrorMessage(error));
  }
}
