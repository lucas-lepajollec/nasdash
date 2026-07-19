'use client';

import React, { createContext, useContext, useState, useEffect, useLayoutEffect, useRef } from 'react';

const useIsomorphicLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect;

export type WidgetSizeBucket = 'narrow' | 'medium' | 'wide';

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
  const [size, setSize] = useState<WidgetSizeContextType>(() => {
    if (typeof window !== 'undefined') {
      const approxW = Math.max(300, window.innerWidth - 500);
      let bucket: WidgetSizeBucket = 'narrow';
      if (approxW >= 720) bucket = 'wide';
      else if (approxW >= 380) bucket = 'medium';
      return { width: approxW, height: 200, size: bucket };
    }
    return { width: 500, height: 200, size: 'medium' };
  });

  useIsomorphicLayoutEffect(() => {
    if (!containerRef.current) return;
    const width = containerRef.current.clientWidth;
    const height = containerRef.current.clientHeight;
    if (width > 0) {
      let bucket: WidgetSizeBucket = 'narrow';
      if (width >= 720) bucket = 'wide';
      else if (width >= 380) bucket = 'medium';
      setSize({ width, height, size: bucket });
    }

    const observer = new ResizeObserver((entries) => {
      if (!entries || entries.length === 0) return;
      const { width: w, height: h } = entries[0].contentRect;
      if (w <= 0) return;
      let bucket: WidgetSizeBucket = 'narrow';
      if (w >= 720) bucket = 'wide';
      else if (w >= 380) bucket = 'medium';
      
      setSize({ width: w, height: h, size: bucket });
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
