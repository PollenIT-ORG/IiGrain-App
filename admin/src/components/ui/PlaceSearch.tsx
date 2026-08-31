import { useEffect, useRef, useState } from "react";
import type { LatLng } from "../../lib/geo";

interface SearchResult {
  display_name: string;
  lat: string;
  lon: string;
}

/** Place lookup shared by the point picker and the boundary editor. */
export default function PlaceSearch({
  onPick,
  placeholder = "Search a place, address or city...",
  className = "",
}: {
  onPick: (value: LatLng, label: string) => void;
  placeholder?: string;
  className?: string;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 3) {
      setResults([]);
      return;
    }
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        setSearching(true);
        const url =
          "https://nominatim.openstreetmap.org/search?format=json&limit=6&q=" +
          encodeURIComponent(q);
        const res = await fetch(url, {
          signal: controller.signal,
          headers: { "Accept-Language": "en" },
        });
        const data: SearchResult[] = await res.json();
        setResults(data);
        setShowResults(true);
      } catch {
        // aborted or network error; a newer keystroke retries
      } finally {
        setSearching(false);
      }
    }, 450);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) {
        setShowResults(false);
      }
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  function choose(r: SearchResult) {
    onPick({ lat: Number(r.lat), lng: Number(r.lon) }, r.display_name);
    setShowResults(false);
    setQuery(r.display_name);
  }

  return (
    <div ref={boxRef} className={`relative ${className}`}>
      <input
        type="text"
        className="input-field text-sm"
        placeholder={placeholder}
        maxLength={200}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => results.length && setShowResults(true)}
      />
      {searching && (
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">
          Searching...
        </span>
      )}
      {showResults && results.length > 0 && (
        <ul className="absolute z-[1100] mt-1 max-h-56 w-full overflow-auto rounded-lg border border-gray-300 bg-white shadow-lg">
          {results.map((r, i) => (
            <li key={`${r.lat}-${r.lon}-${i}`}>
              <button
                type="button"
                onClick={() => choose(r)}
                className="block w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-100"
              >
                {r.display_name}
              </button>
            </li>
          ))}
        </ul>
      )}
      {showResults && !searching && query.trim().length >= 3 && results.length === 0 && (
        <div className="absolute z-[1100] mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-500 shadow-lg">
          No places found.
        </div>
      )}
    </div>
  );
}
