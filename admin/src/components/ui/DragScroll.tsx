import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";

/**
 * A sideways strip that can be dragged with the mouse.
 *
 * The monitoring tabs and the record tables are both wider than the card they
 * sit in, and on a laptop without a sideways wheel the only way across was the
 * scrollbar itself. Holding the mouse down and pulling is what people reach for
 * first, so that is what this does.
 *
 * With the content draggable the bar has no job left except saying where you
 * are, so the browser's own is hidden and a one pixel line is drawn instead.
 * Drawn rather than styled because `::-webkit-scrollbar` is ignored by Chrome
 * on any element carrying `scrollbar-width`, which the global rule sets on
 * everything: the height would come out as whatever the browser felt like.
 * This way it is one pixel in every browser.
 *
 * Touch and pen are left alone. They already scroll, and better than anything
 * reproduced here.
 */
export default function DragScroll({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const thumbRef = useRef<HTMLDivElement>(null);
  const [scrollable, setScrollable] = useState(false);

  /**
   * Where the line sits. Written straight to the node rather than held in
   * state, so dragging does not re-render the table on every frame.
   */
  const paint = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const room = el.scrollWidth - el.clientWidth;
    // The grab cursor and the line are only honest when there is somewhere
    // to go.
    setScrollable(room > 1);
    const thumb = thumbRef.current;
    if (!thumb || room <= 1) return;
    thumb.style.width = `${(el.clientWidth / el.scrollWidth) * 100}%`;
    thumb.style.left = `${(el.scrollLeft / el.scrollWidth) * 100}%`;
  }, []);

  // Switching tab swaps the columns, so the width changes without a resize.
  useEffect(paint);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.addEventListener("scroll", paint, { passive: true });
    const observer = new ResizeObserver(paint);
    observer.observe(el);
    if (el.firstElementChild) observer.observe(el.firstElementChild);
    return () => {
      el.removeEventListener("scroll", paint);
      observer.disconnect();
    };
  }, [paint]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    // Under this a press is a click, over it a drag. Without the gap, every
    // click on a tab would nudge the strip a pixel or two sideways.
    const THRESHOLD = 4;

    let pointerId = -1;
    let startX = 0;
    let startScrollLeft = 0;
    let dragged = false;

    const onPointerDown = (e: PointerEvent) => {
      // Cleared here rather than on release: a drag that ends outside the
      // element never gets its click, and the flag has to lift anyway.
      dragged = false;
      if (e.pointerType !== "mouse" || e.button !== 0) return;
      if (el.scrollWidth <= el.clientWidth) return;
      pointerId = e.pointerId;
      startX = e.clientX;
      startScrollLeft = el.scrollLeft;
    };

    const onPointerMove = (e: PointerEvent) => {
      if (e.pointerId !== pointerId) return;
      const dx = e.clientX - startX;
      if (!dragged) {
        if (Math.abs(dx) < THRESHOLD) return;
        dragged = true;
        // Capture so the strip keeps following the mouse past its own edge.
        el.setPointerCapture(pointerId);
        el.classList.add("is-dragging");
      }
      el.scrollLeft = startScrollLeft - dx;
      // Otherwise the browser starts selecting the text being dragged over.
      e.preventDefault();
    };

    const onPointerUp = (e: PointerEvent) => {
      if (e.pointerId !== pointerId) return;
      if (el.hasPointerCapture(pointerId)) el.releasePointerCapture(pointerId);
      el.classList.remove("is-dragging");
      pointerId = -1;
    };

    /**
     * The click that follows a drag would land on whichever tab or row happened
     * to be under the mouse when it stopped, switching the tab or opening a
     * record nobody asked for. Caught on the way down, so it never arrives.
     */
    const onClickCapture = (e: MouseEvent) => {
      if (!dragged) return;
      e.preventDefault();
      e.stopPropagation();
    };

    el.addEventListener("pointerdown", onPointerDown);
    el.addEventListener("pointermove", onPointerMove);
    el.addEventListener("pointerup", onPointerUp);
    el.addEventListener("pointercancel", onPointerUp);
    el.addEventListener("click", onClickCapture, true);
    return () => {
      el.removeEventListener("pointerdown", onPointerDown);
      el.removeEventListener("pointermove", onPointerMove);
      el.removeEventListener("pointerup", onPointerUp);
      el.removeEventListener("pointercancel", onPointerUp);
      el.removeEventListener("click", onClickCapture, true);
    };
  }, []);

  return (
    <div className="relative">
      <div
        ref={ref}
        className={`drag-scroll${scrollable ? " is-scrollable" : ""}${
          className ? " " + className : ""
        }`}
      >
        {children}
      </div>
      {scrollable && (
        <div className="drag-scroll-rail" aria-hidden="true">
          <div ref={thumbRef} className="drag-scroll-thumb" />
        </div>
      )}
    </div>
  );
}
