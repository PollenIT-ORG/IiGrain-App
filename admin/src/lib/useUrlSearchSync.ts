import { useEffect } from "react";
import { useSearchParams } from "react-router-dom";

// Pushes the URL's ?search= value into a list page's search box, both on first
// render and whenever the topbar navigates back here with a new term. Typing in
// the box does not change the URL, so it never fights the user's input.
export function useUrlSearchSync(setSearchInput: (v: string) => void): void {
  const [params] = useSearchParams();
  const urlSearch = params.get("search") ?? "";
  useEffect(() => {
    if (urlSearch) setSearchInput(urlSearch);
  }, [urlSearch, setSearchInput]);
}
