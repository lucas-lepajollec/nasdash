import React from 'react';
import { ChevronDown } from 'lucide-react';

export function SettingsSection({ 
  title, 
  description, 
  isOpen, 
  onToggle, 
  children 
}: { 
  title: string, 
  description?: string, 
  isOpen: boolean, 
  onToggle: (open: boolean) => void, 
  children: React.ReactNode 
}) {
  return (
    <details 
      className="nd-settings-details group"
      open={isOpen}
      onToggle={(e) => onToggle((e.currentTarget as HTMLDetailsElement).open)}
      style={{
        background: 'rgba(255,255,255,0.02)',
        border: '1px solid var(--nd-card-border)',
        borderRadius: 'var(--nd-card-radius)',
        overflow: 'hidden'
      }}
    >
      <summary 
        onClick={(e) => {
          e.preventDefault();
          onToggle(!isOpen);
        }}
        style={{
          padding: '14px',
          cursor: 'pointer',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          listStyle: 'none',
          userSelect: 'none'
        }}
      >
        <div>
          <h4 style={{ margin: 0, fontSize: '0.82rem', fontWeight: 600, color: 'var(--nd-text)' }}>{title}</h4>
          {description && <p style={{ margin: '4px 0 0 0', fontSize: '0.7rem', color: 'var(--nd-text-muted)' }}>{description}</p>}
        </div>
        <div style={{ transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>
          <ChevronDown size={16} style={{ color: 'var(--nd-text-muted)' }} />
        </div>
      </summary>
      
      <style dangerouslySetInnerHTML={{__html: `
        details > summary::-webkit-details-marker {
          display: none;
        }
      `}} />

      <div style={{ padding: '0 14px 14px 14px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        {children}
      </div>
    </details>
  );
}
