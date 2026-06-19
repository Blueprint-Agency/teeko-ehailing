import { useEffect, useRef, useState } from 'react';

import type { DirectionsResult, FetchDirectionsOptions } from '@teeko/shared';

export type DirectionsFetcher = (
  origin: { lat: number; lng: number },
  destination: { lat: number; lng: number },
  options?: FetchDirectionsOptions,
) => Promise<DirectionsResult>;

export interface UseDirectionsArgs {
  origin: { lat: number; lng: number } | null | undefined;
  destination: { lat: number; lng: number } | null | undefined;
  /** The function that performs the HTTP call — injected by the caller so this
   *  hook has no knowledge of keys, tokens, or base URLs. */
  fetcher: DirectionsFetcher;
  options?: FetchDirectionsOptions;
  /** Set to false to pause fetching (e.g. phases that don't need directions). */
  enabled?: boolean;
}

export interface UseDirectionsState {
  result: DirectionsResult | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useDirections({
  origin,
  destination,
  fetcher,
  options,
  enabled = true,
}: UseDirectionsArgs): UseDirectionsState {
  const [result, setResult] = useState<DirectionsResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const idRef = useRef(0);

  const run = () => {
    if (!origin || !destination || !enabled) return;
    const id = ++idRef.current;
    setLoading(true);
    setError(null);
    fetcher(origin, destination, options)
      .then((r) => {
        if (idRef.current === id) { setResult(r); setLoading(false); }
      })
      .catch((e: Error) => {
        if (idRef.current === id) { setError(e.message); setLoading(false); }
      });
  };

  useEffect(() => {
    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [origin?.lat, origin?.lng, destination?.lat, destination?.lng, enabled]);

  return { result, loading, error, refetch: run };
}
