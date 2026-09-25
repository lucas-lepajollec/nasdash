'use client';

import React, { useState, useRef, useEffect, useId } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Check } from 'lucide-react';
import { useI18n } from '@/i18n/I18nProvider';

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
  const { t } = useI18n();
  const [isOpen, setIsOpen] = useState(false);
  const [place, setPlace] = useState<{ left: number; width: number; top?: number; bottom?: number; maxHeight: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const optionRefs = useRef<Array<HTMLDivElement | null>>([]);
  const id = useId();
  const listboxId = `custom-select-${id}`;

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent | TouchEvent) => {
      const target = e.target as Node;
      if (containerRef.current && !containerRef.current.contains(target) && !listRef.current?.contains(target)) {
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

  // The list is drawn above the page (portal, fixed position) so no dialog
  // or scroll area can clip it. It opens downward, or upward when there is
  // more room above, and never taller than the room it has.
  const measure = () => {
    const trigger = triggerRef.current;
    if (!trigger) return;
    const box = trigger.getBoundingClientRect();
    const margin = 8;
    const below = window.innerHeight - box.bottom - margin;
    const above = box.top - margin;
    const wanted = Math.min(280, 12 + options.length * 36);
    const up = below < wanted && above > below;
    const maxHeight = Math.max(120, Math.min(280, (up ? above : below) - 4));
    setPlace({
      left: box.left,
      width: box.width,
      maxHeight,
      ...(up ? { bottom: window.innerHeight - box.top + 4 } : { top: box.bottom + 4 }),
    });
  };

  useEffect(() => {
    if (!isOpen) return;
    const follow = () => measure();
    window.addEventListener('resize', follow);
    window.addEventListener('scroll', follow, true);
    return () => {
      window.removeEventListener('resize', follow);
      window.removeEventListener('scroll', follow, true);
    };
  });

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
    measure();
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

      {isOpen && place && typeof document !== 'undefined' && createPortal(
        <div
          ref={listRef}
          id={listboxId}
          role="listbox"
          aria-label={ariaLabel || t("Options")}
          data-dialog-escape-boundary="true"
          style={{
          position: 'fixed',
          ...(place.top !== undefined ? { top: place.top } : { bottom: place.bottom }),
          left: place.left,
          width: place.width,
          boxSizing: 'border-box',
          // Opaque, whatever the card opacity chosen in Appearance.
          background: 'var(--nd-bg-surface, var(--nd-bg))',
          border: '1px solid var(--nd-card-border)',
          borderRadius: 'var(--nd-card-radius)',
          boxShadow: '0 8px 24px rgba(0,0,0,0.2)',
          // Above the dialogs' overlay (z-index 99999).
          zIndex: 100001,
          overflowY: 'auto',
          maxHeight: place.maxHeight,
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
        </div>,
        document.body,
      )}
    </div>
  );
}
