import React from 'react';

export interface ToggleSwitchProps {
  checked: boolean;
  onChange: (val: boolean) => void;
  label?: React.ReactNode;
  sublabel?: string;
}

export function ToggleSwitch({ checked, onChange, label, sublabel }: ToggleSwitchProps) {
  return (
    <div 
      onClick={() => onChange(!checked)}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        cursor: 'pointer',
        userSelect: 'none'
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginRight: 16 }}>
        {label && <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--nd-text)' }}>{label}</span>}
        {sublabel && <span style={{ fontSize: '0.66rem', color: 'var(--nd-text-muted)' }}>{sublabel}</span>}
      </div>
      <div 
        style={{
          width: '36px',
          height: '18px',
          borderRadius: '9px',
          background: checked ? 'var(--nd-green)' : 'var(--nd-toggle-bg, rgba(120, 120, 128, 0.25))',
          border: checked ? 'none' : '1px solid var(--nd-card-border)',
          position: 'relative',
          transition: 'all 0.2s ease',
          flexShrink: 0
        }}
      >
        <div 
          style={{
            width: '12px',
            height: '12px',
            borderRadius: '50%',
            background: checked ? '#ffffff' : 'var(--nd-text-muted)',
            position: 'absolute',
            top: checked ? '3px' : '2px',
            left: checked ? '21px' : '3px',
            transition: 'all 0.2s ease',
          }}
        />
      </div>
    </div>
  );
}
