import { useRef, useState, useEffect, type DependencyList, type MutableRefObject } from 'react';

/**
 * useStickyRef — Détecte si un élément peut être en position sticky
 * (quand son contenu tient dans la fenêtre) et retourne le ref + l'état.
 *
 * Usage:
 *   const [sidebarRef, isSticky] = useStickyRef([dep1, dep2]);
 *
 * L'élément est sticky si son scrollHeight + margeVertical < window.innerHeight.
 * En dessous de 960px (mobile), on force isSticky=false via CSS (position: static !important).
 */
export function useStickyRef<T extends HTMLElement>(
  deps: DependencyList = [],
  verticalMargin = 40
): [MutableRefObject<T | null>, boolean] {
  const ref = useRef<T | null>(null);
  const [isSticky, setIsSticky] = useState(true);

  useEffect(() => {
    const check = () => {
      if (ref.current) {
        setIsSticky(ref.current.scrollHeight + verticalMargin < window.innerHeight);
      }
    };

    check();
    window.addEventListener('resize', check);

    const observer = new ResizeObserver(check);
    if (ref.current) observer.observe(ref.current);

    return () => {
      window.removeEventListener('resize', check);
      observer.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return [ref, isSticky];
}
