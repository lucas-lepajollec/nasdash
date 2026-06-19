'use client';

import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check } from 'lucide-react';

interface Option {
  value: string;
  label: string;
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

  const selectedOption = options.find(o => o.value === value) || options[0];

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
          background: 'var(--nd-bg-surface)',
          border: '1px solid var(--nd-card-border)',
          borderRadius: 'var(--nd-card-radius)',
          boxShadow: 'var(--nd-dropdown-shadow, 0 4px 12px rgba(0,0,0,0.15))',
          zIndex: 100,
          overflowY: 'auto',
          maxHeight: '250px',
          display: 'flex',
          flexDirection: 'column',
        }}>
          {options.map((opt, idx) => (
            <div
              key={opt.value}
              onClick={() => {
                onChange(opt.value);
                setIsOpen(false);
              }}
              style={{
                padding: '10px 12px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                background: value === opt.value ? 'rgba(128, 128, 128, 0.08)' : 'transparent',
                borderBottom: idx === options.length - 1 ? 'none' : '1px solid var(--nd-card-border)',
                fontSize: '0.8rem',
                color: value === opt.value ? 'var(--nd-text)' : 'var(--nd-text-muted)',
                transition: 'background 0.2s, color 0.2s'
              }}
              onMouseEnter={(e) => {
                if (value !== opt.value) {
                  e.currentTarget.style.background = 'rgba(128, 128, 128, 0.05)';
                  e.currentTarget.style.color = 'var(--nd-text)';
                }
              }}
              onMouseLeave={(e) => {
                if (value !== opt.value) {
                  e.currentTarget.style.background = 'transparent';
                  e.currentTarget.style.color = 'var(--nd-text-muted)';
                }
              }}
            >
              <span>{opt.label}</span>
              {value === opt.value && <Check size={14} color="var(--nd-accent)" />}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
