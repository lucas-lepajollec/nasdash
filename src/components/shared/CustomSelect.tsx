'use client';

import React, { useState, useRef, useEffect, useId } from 'react';
import { ChevronDown, Check } from 'lucide-react';

interface Option {
  value: string;
  label: React.ReactNode;
  isHeader?: boolean;
}

interface CustomSelectProps {
  value: string;
  options: Option[];
  onChange: (val: string) => void;
  className?: string;
  style?: React.CSSProperties;
  disabled?: boolean;
  ariaLabel?: string;
}

export default function CustomSelect({ value, options, onChange, className, style, disabled, ariaLabel }: CustomSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const optionRefs = useRef<Array<HTMLDivElement | null>>([]);
  const id = useId();
  const listboxId = `custom-select-${id}`;

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
  const selectableOptions = options.filter(option => !option.isHeader);
  const selectedIndex = Math.max(0, selectableOptions.findIndex(option => option.value === selectedOption?.value));

  const closeMenu = (restoreTriggerFocus = false) => {
    setIsOpen(false);
    if (restoreTriggerFocus) {
      window.requestAnimationFrame(() => triggerRef.current?.focus());
    }
  };

  const openMenu = (focusSelectedOption = false) => {
    if (disabled) return;
    setIsOpen(true);
    window.dispatchEvent(new CustomEvent('customSelectOpen', { detail: id }));
    if (focusSelectedOption) {
      window.requestAnimationFrame(() => optionRefs.current[selectedIndex]?.focus());
    }
  };

  const selectOption = (option: Option) => {
    onChange(option.value);
    closeMenu(true);
  };

  const handleOptionKeyDown = (event: React.KeyboardEvent<HTMLDivElement>, option: Option, index: number) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      selectOption(option);
      return;
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      closeMenu(true);
      return;
    }
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp' || event.key === 'Home' || event.key === 'End') {
      event.preventDefault();
      let nextIndex = index;
      if (event.key === 'ArrowDown') nextIndex = (index + 1) % selectableOptions.length;
      if (event.key === 'ArrowUp') nextIndex = (index - 1 + selectableOptions.length) % selectableOptions.length;
      if (event.key === 'Home') nextIndex = 0;
      if (event.key === 'End') nextIndex = selectableOptions.length - 1;
      optionRefs.current[nextIndex]?.focus();
    }
  };

  return (
    <div ref={containerRef} style={{ position: 'relative', width: '100%', opacity: disabled ? 0.6 : 1, ...style }} className={className}>
      <button
        ref={triggerRef}
        type="button"
        className="nd-input" 
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-controls={listboxId}
        disabled={disabled}
        onClick={() => {
          if (isOpen) {
            closeMenu();
          } else {
            openMenu();
          }
        }}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault();
            if (isOpen) {
              optionRefs.current[selectedIndex]?.focus();
            } else {
              openMenu(true);
            }
          }
          if (event.key === 'Escape' && isOpen) {
            event.preventDefault();
            closeMenu();
          }
        }}
        style={{ 
          width: '100%',
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'space-between', 
          cursor: disabled ? 'not-allowed' : 'pointer',
          borderColor: isOpen ? 'var(--nd-accent)' : undefined,
          appearance: 'none',
          textAlign: 'left'
        }}
      >
        <span>{selectedOption?.label}</span>
        {!disabled && <ChevronDown size={14} style={{ opacity: 0.5, transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />}
      </button>

      {isOpen && (
        <div
          id={listboxId}
          role="listbox"
          aria-label={ariaLabel || 'Options'}
          data-dialog-escape-boundary="true"
          style={{
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
          }}
        >
          {options.map((opt) => {
            if (opt.isHeader) {
              return (
                <div
                  key={opt.value}
                  role="presentation"
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
            const optionIndex = selectableOptions.indexOf(opt);

            return (
              <div
                key={opt.value}
                ref={(element) => { optionRefs.current[optionIndex] = element; }}
                role="option"
                aria-selected={isSelected}
                tabIndex={optionIndex === selectedIndex ? 0 : -1}
                onClick={() => selectOption(opt)}
                onKeyDown={(event) => handleOptionKeyDown(event, opt, optionIndex)}
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
