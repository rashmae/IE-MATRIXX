import { useState, useEffect } from 'react';

/**
 * A hook that tracks the state of a media query.
 * 
 * @param query The CSS media query string
 * @returns Boolean indicating if the query matches
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    const media = window.matchMedia(query);
    if (media.matches !== matches) {
      setMatches(media.matches);
    }

    const listener = () => setMatches(media.matches);
    media.addEventListener('change', listener);
    
    return () => media.removeEventListener('change', listener);
  }, [query, matches]);

  return matches;
}

/**
 * Helper hook for mobile detection (max-width: 640px - Tailwind 'sm')
 */
export function useIsMobile() {
  return useMediaQuery('(max-width: 640px)');
}

/**
 * Helper hook for tablet detection (max-width: 1024px - Tailwind 'lg')
 */
export function useIsTablet() {
  return useMediaQuery('(max-width: 1024px)');
}
