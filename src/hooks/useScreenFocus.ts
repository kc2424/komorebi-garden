import { useEffect, useRef } from 'react';

export function useScreenFocus(deps: unknown[]) {
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    if (typeof window.scrollTo === 'function') {
      window.scrollTo(0, 0);
    }
    headingRef.current?.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return headingRef;
}
