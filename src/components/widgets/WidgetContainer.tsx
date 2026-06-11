'use client';

import React, { createContext, useContext, useState, useEffect, useRef } from 'react';

export type WidgetSizeBucket = 'narrow' | 'medium' | 'wide';

interface WidgetSizeContextType {
  width: number;
  height: number;
  size: WidgetSizeBucket;
}

const WidgetSizeContext = createContext<WidgetSizeContextType>({
  width: 300,
  height: 200,
  size: 'narrow'
});

export const useWidgetSize = () => useContext(WidgetSizeContext);

export function WidgetContainer({ children, className = '', style = {} }: { children: React.ReactNode, className?: string, style?: React.CSSProperties }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState<WidgetSizeContextType>({
    width: 300,
    height: 200,
    size: 'narrow'
  });

  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      if (!entries || entries.length === 0) return;
      const { width, height } = entries[0].contentRect;
      let bucket: WidgetSizeBucket = 'narrow';
      if (width >= 720) bucket = 'wide';
      else if (width >= 380) bucket = 'medium';
      
      setSize({ width, height, size: bucket });
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
