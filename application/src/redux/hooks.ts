import { useDispatch, useSelector, useStore } from 'react-redux';
import type { TypedUseSelectorHook } from 'react-redux';
import type { RootState, AppDispatch, store as appStore } from './store';

export const useAppDispatch = () => useDispatch<AppDispatch>();
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector;

/** Typed `useStore` — for reading the latest state imperatively (e.g. a
 *  repository that must read-then-write without subscribing). Prefer
 *  useAppSelector for anything that should re-render. */
export const useAppStore = (): typeof appStore => useStore<RootState>() as typeof appStore;
