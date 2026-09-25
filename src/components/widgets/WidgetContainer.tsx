'use client';

import React, { createContext, useContext, useState, useEffect, useLayoutEffect, useRef } from 'react';
import { getWidgetSizeBucket, type WidgetSizeBucket } from '@/lib/widgetSizing';

const useIsomorphicLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect;

export type { WidgetSizeBucket } from '@/lib/widgetSizing';

interface WidgetSizeContextType {
  width: number;
  height: number;
  size: WidgetSizeBucket;
}

const WidgetSizeContext = createContext<WidgetSizeContextType>({
  width: 500,
  height: 200,
  size: 'medium'
});

export const useWidgetSize = () => useContext(WidgetSizeContext);

export function WidgetContainer({ children, className = '', style = {} }: { children: React.ReactNode, className?: string, style?: React.CSSProperties }) {
  const containerRef = useRef<HTMLDivElement>(null);
  // Match server HTML on the first client render. Measure the actual container
  // in the layout effect, before paint, rather than guessing from viewport width.
  const [size, setSize] = useState<WidgetSizeContextType>({ width: 500, height: 200, size: 'medium' });

  useIsomorphicLayoutEffect(() => {
    if (!containerRef.current) return;
    const width = containerRef.current.clientWidth;
    const height = containerRef.current.clientHeight;
    if (width > 0) {
      setSize({ width, height, size: getWidgetSizeBucket(width) });
    }

    const observer = new ResizeObserver((entries) => {
      if (!entries || entries.length === 0) return;
      const { width: w, height: h } = entries[0].contentRect;
      if (w <= 0) return;
      setSize({ width: w, height: h, size: getWidgetSizeBucket(w) });
    });

    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  return (
    <WidgetSizeContext.Provider value={size}>
      <div 
        ref={containerRef} 
        className={`nd-widget-container nd-widget-size-${size.size} ${className}`}
        style={{
          containerType: 'inline-size',
          containerName: 'widget',
          width: '100%',
          ...style
        }}
      >
        {children}
      </div>
    </WidgetSizeContext.Provider>
  );
}
