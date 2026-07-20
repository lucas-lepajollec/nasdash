'use client';

import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check } from 'lucide-react';

interface Option {
  value: string;
  label: string;
  isHeader?: boolean;
}

interface CustomSelectProps {
  value: string;
  options: Option[];
  onChange: (val: string) => void;
  className?: string;
  style?: React.CSSProperties;
  disabled?: boolean;
}

export default function CustomSelect({ value, options, onChange, className, style, disabled }: CustomSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const [id] = useState(() => Math.random().toString(36).substring(2, 9));

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent | TouchEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    
    const handleOtherSelectOpen = (e: Event) => {
      const customEvent = e as CustomEvent;
      if (customEvent.detail !== id) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('touchstart', handleClickOutside);
      window.addEventListener('customSelectOpen', handleOtherSelectOpen);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
      window.removeEventListener('customSelectOpen', handleOtherSelectOpen);
    };
  }, [isOpen, id]);

  const selectedOption = options.find(o => o.value === value) || options.find(o => !o.isHeader) || options[0];

  return (
    <div ref={containerRef} style={{ position: 'relative', width: '100%', opacity: disabled ? 0.6 : 1, ...style }} className={className}>
      <div 
        className="nd-input" 
        onClick={() => {
          if (disabled) return;
          const nextState = !isOpen;
          setIsOpen(nextState);
          if (nextState) {
            window.dispatchEvent(new CustomEvent('customSelectOpen', { detail: id }));
          }
        }}
        style={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'space-between', 
          cursor: disabled ? 'not-allowed' : 'pointer',
          borderColor: isOpen ? 'var(--nd-accent)' : undefined
        }}
      >
        <span>{selectedOption?.label}</span>
        {!disabled && <ChevronDown size={14} style={{ opacity: 0.5, transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />}
      </div>

      {isOpen && (
        <div style={{
          position: 'absolute',
          top: 'calc(100% + 4px)',
          left: 0,
          right: 0,
          background: 'var(--nd-card-bg)',
          border: '1px solid var(--nd-card-border)',
          borderRadius: 'var(--nd-card-radius)',
          boxShadow: '0 8px 24px rgba(0,0,0,0.2)',
          zIndex: 100,
          overflowY: 'auto',
          maxHeight: '280px',
          padding: '6px',
          display: 'flex',
          flexDirection: 'column',
          gap: 2
        }}>
          {options.map((opt) => {
            if (opt.isHeader) {
              return (
                <div
                  key={opt.value}
                  style={{
                    padding: '8px 10px 4px 10px',
                    fontSize: '0.62rem',
                    fontWeight: 800,
                    letterSpacing: '0.8px',
                    color: 'var(--nd-text-dimmed)',
                    textTransform: 'uppercase',
                    userSelect: 'none',
                    pointerEvents: 'none'
                  }}
                >
                  {opt.label}
                </div>
              );
            }

            const isSelected = value === opt.value;

            return (
              <div
                key={opt.value}
                onClick={() => {
                  onChange(opt.value);
                  setIsOpen(false);
                }}
                style={{
                  padding: '8px 12px',
                  borderRadius: 'calc(var(--nd-card-radius) * 0.6)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  background: isSelected ? 'var(--nd-accent-glow)' : 'transparent',
                  fontSize: '0.78rem',
                  fontWeight: isSelected ? 600 : 400,
                  color: isSelected ? 'var(--nd-accent)' : 'var(--nd-text)',
                  transition: 'all 0.15s ease'
                }}
                onMouseEnter={(e) => {
                  if (!isSelected) {
                    e.currentTarget.style.background = 'var(--nd-subcard-bg)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isSelected) {
                    e.currentTarget.style.background = 'transparent';
                  }
                }}
              >
                <span>{opt.label}</span>
                {isSelected && <Check size={14} color="var(--nd-accent)" />}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
