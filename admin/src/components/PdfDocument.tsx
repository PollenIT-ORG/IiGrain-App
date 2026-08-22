import { useEffect, useRef, useState, type ReactNode } from "react";
import type { PDFDocumentProxy } from "pdfjs-dist";
// Bundled by us, so it is served as JavaScript whatever the host does with
// unknown file extensions.
import PdfWorker from "pdfjs-dist/build/pdf.worker.min.mjs?worker";

// Draws a PDF onto the page itself, one canvas per page. The browser's own PDF
// viewer is not involved, so there is no toolbar, no sidebar and no download
// bar around the document - just the pages, the way they print.

interface PageSize {
  width: number;
  height: number;
}

interface Props {
  /** The file itself. Null while it is still being fetched. */
  data: Uint8Array | null;
  /** Height of the scrolling area, e.g. "h-[32rem]". */
  className?: string;
  /** Shown in place of the pages while loading, or if the file cannot be read. */
  placeholder?: ReactNode;
  onError?: () => void;
}

// Sharper on high density screens, without making the canvases needlessly big.
const MAX_RATIO = 2;
// Redraw only when the width really changes, not on every pixel of a resize.
const RESIZE_STEP = 24;

export default function PdfDocument({
  data,
  className = "h-[32rem]",
  placeholder,
  onError,
}: Props) {
  const holder = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null);
  const [sizes, setSizes] = useState<PageSize[]>([]);

  // Follow the width of the column the pages are drawn into.
  useEffect(() => {
    const el = holder.current;
    if (!el) return;
    const apply = (next: number) =>
      setWidth((current) =>
        current === 0 || Math.abs(next - current) >= RESIZE_STEP ? next : current
      );
    apply(el.clientWidth);
    const observer = new ResizeObserver((entries) => {
      const box = entries[0]?.contentRect;
      if (box) apply(Math.round(box.width));
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Open the file and measure its pages, so the space is reserved before they
  // are drawn and nothing jumps around.
  useEffect(() => {
    if (!data) return;
    let cancelled = false;
    let opened: PDFDocumentProxy | null = null;
    const worker = new PdfWorker();

    void (async () => {
      try {
        const pdfjs = await import("pdfjs-dist");
        pdfjs.GlobalWorkerOptions.workerPort = worker;
        // The library takes over the bytes it is given, so it gets a copy.
        opened = await pdfjs.getDocument({ data: data.slice() }).promise;
        const measured: PageSize[] = [];
        for (let n = 1; n <= opened.numPages; n += 1) {
          const page = await opened.getPage(n);
          const view = page.getViewport({ scale: 1 });
          measured.push({ width: view.width, height: view.height });
        }
        if (cancelled) {
          void opened.destroy();
          return;
        }
        setSizes(measured);
        setDoc(opened);
      } catch {
        if (!cancelled) onError?.();
      }
    })();

    return () => {
      cancelled = true;
      void opened?.destroy();
      worker.terminate();
      setDoc(null);
      setSizes([]);
    };
    // onError only reports; it must not restart the load.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  // Draw the pages once they have their place on screen.
  useEffect(() => {
    const el = holder.current;
    if (!doc || !el || width < 1 || !sizes.length) return;
    let cancelled = false;
    const running: Array<{ cancel: () => void }> = [];

    void (async () => {
      const ratio = Math.min(window.devicePixelRatio || 1, MAX_RATIO);
      for (let n = 1; n <= sizes.length; n += 1) {
        if (cancelled) return;
        const canvas = el.querySelector<HTMLCanvasElement>(`canvas[data-page="${n}"]`);
        const context = canvas?.getContext("2d");
        if (!canvas || !context) continue;
        const page = await doc.getPage(n);
        if (cancelled) return;
        const viewport = page.getViewport({
          scale: (width / sizes[n - 1].width) * ratio,
        });
        canvas.width = Math.floor(viewport.width);
        canvas.height = Math.floor(viewport.height);
        const task = page.render({ canvasContext: context, viewport });
        running.push(task);
        try {
          await task.promise;
        } catch {
          // Cancelled because the width changed or the page was left.
          return;
        }
      }
    })();

    return () => {
      cancelled = true;
      for (const task of running) task.cancel();
    };
  }, [doc, sizes, width]);

  return (
    <div
      // The pages grow from a placeholder to their real size; without this the
      // browser keeps its anchor in view and the reader lands mid-document.
      style={{ overflowAnchor: "none" }}
      className={`w-full overflow-y-auto rounded-xl border border-gray-300 bg-gray-200/70 ${className}`}
    >
      <div ref={holder} className="mx-auto flex max-w-3xl flex-col gap-5 p-5">
        {!sizes.length ? (
          <div className="grid min-h-[22rem] place-items-center px-6 text-center text-sm text-gray-700">
            {placeholder ?? <span>Loading the contract...</span>}
          </div>
        ) : (
          sizes.map((size, i) => (
            <canvas
              key={i + 1}
              data-page={i + 1}
              role="img"
              aria-label={`Contract page ${i + 1} of ${sizes.length}`}
              style={{ aspectRatio: `${size.width} / ${size.height}` }}
              className="w-full bg-white shadow-md ring-1 ring-black/10"
            />
          ))
        )}
      </div>
    </div>
  );
}
