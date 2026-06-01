import React from 'react';

export interface ToggleSwitchProps {
  checked: boolean;
  onChange: (val: boolean) => void;
  label?: string;
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
          background: checked ? 'var(--nd-green)' : 'rgba(255,255,255,0.08)',
          border: checked ? 'none' : '1px solid var(--nd-card-border)',
          position: 'relative',
          transition: 'all 0.2s ease',
          flexShrink: 0,
          boxShadow: checked ? '0 0 8px rgba(63, 185, 80, 0.3)' : 'none'
        }}
      >
        <div 
          style={{
            width: '12px',
            height: '12px',
            borderRadius: '50%',
            background: checked ? '#ffffff' : '#888888',
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
