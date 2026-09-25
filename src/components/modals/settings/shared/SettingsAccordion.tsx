import React from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { useCalme } from '@/widgets/calme';

export interface SettingsAccordionProps {
  title: string;
  description?: string;
  icon?: React.ReactNode;
  isOpen: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}

export function SettingsAccordion({ title, description, icon, isOpen, onToggle, children }: SettingsAccordionProps) {
  const calme = useCalme();
  if (calme) {
    return (
      <section className={`ndc-set-section ${isOpen ? 'is-open' : ''}`}>
        <button type="button" className="ndc-set-section-head" aria-expanded={isOpen} onClick={onToggle}>
          <span className="ndc-set-section-lead">
            {icon && <span className="ndc-set-section-icon" aria-hidden="true">{icon}</span>}
            <span>
              <span className="ndc-set-section-title">{title}</span>
              {description && <span className="ndc-set-section-desc">{description}</span>}
            </span>
          </span>
          <ChevronDown size={15} className="ndc-set-chevron" aria-hidden="true" />
        </button>
        {isOpen && <div className="ndc-set-section-body">{children}</div>}
      </section>
    );
  }
  return (
    <div className="nd-settings-card" style={{ padding: 0, background: 'var(--nd-card-bg)', border: '1px solid var(--nd-card-border)', borderRadius: 'var(--nd-card-radius)', display: 'flex', flexDirection: 'column' }}>
      <button 
        onClick={onToggle}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          width: '100%',
          padding: '14px',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          textAlign: 'left'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {icon && <div style={{ color: 'var(--nd-text-muted)' }}>{icon}</div>}
          <div>
            <h4 style={{ margin: 0, fontSize: '0.82rem', fontWeight: 600, color: 'var(--nd-text)' }}>{title}</h4>
            {description && <p style={{ margin: '2px 0 0 0', fontSize: '0.7rem', color: 'var(--nd-text-muted)' }}>{description}</p>}
          </div>
        </div>
        <ChevronRight size={16} style={{ color: 'var(--nd-text-muted)', transform: isOpen ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s ease', flexShrink: 0 }} />
      </button>
      {isOpen && (
        <div style={{ padding: '20px 14px 14px 14px', borderTop: '1px solid var(--nd-card-border)' }}>
          {children}
        </div>
      )}
    </div>
  );
}
