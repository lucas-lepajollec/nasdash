import React, { useState } from 'react';
import { useConfig } from '@/hooks/useConfig';
import { SettingsSection } from './SettingsSection';
import { WIDGET_REGISTRY, getWidgetConfigKeys } from '@/lib/widgetRegistry';

interface WidgetNetworksLayoutConfigProps {
  widgetId: string;
  isOpen?: boolean;
  onToggle?: (open: boolean) => void;
}

export function WidgetNetworksLayoutConfig({ widgetId, isOpen: controlledIsOpen, onToggle: controlledOnToggle }: WidgetNetworksLayoutConfigProps) {
  const { config, updateConfig } = useConfig();
  const [localIsOpen, setLocalIsOpen] = useState(false);

  const isOpen = controlledIsOpen !== undefined ? controlledIsOpen : localIsOpen;
  const onToggle = controlledOnToggle || setLocalIsOpen;

  const orderKey = `${widgetId}Order`;
  const tabConf = config?.settings?.tabs?.networks || {};

  // 1. Resolve clean, unique, sorted list of widgets to establish a unique position index (0 to 8) on Networks Tab
  const sortedWidgets = WIDGET_REGISTRY.map(w => {
    const keys = getWidgetConfigKeys(w.id);
    const currentVal = (tabConf as any)?.[keys.order] ?? ((config?.settings as any)?.[keys.order] ?? w.defaultOrder);
    return {
      id: w.id,
      orderKey: keys.order,
      defaultOrder: w.defaultOrder,
      currentOrder: Number(currentVal)
    };
  }).sort((a, b) => {
    if (a.currentOrder !== b.currentOrder) {
      return a.currentOrder - b.currentOrder;
    }
    return a.defaultOrder - b.defaultOrder;
  });

  const orderValue = sortedWidgets.findIndex(w => w.orderKey === orderKey);

  const handleOrder = async (newOrder: number) => {
    // 1. Get current sorted list
    const widgets = WIDGET_REGISTRY.map(w => {
      const keys = getWidgetConfigKeys(w.id);
      const currentVal = (tabConf as any)?.[keys.order] ?? ((config?.settings as any)?.[keys.order] ?? w.defaultOrder);
      return {
        id: w.id,
        orderKey: keys.order,
        defaultOrder: w.defaultOrder,
        currentOrder: Number(currentVal)
      };
    });

    widgets.sort((a, b) => {
      if (a.currentOrder !== b.currentOrder) {
        return a.currentOrder - b.currentOrder;
      }
      return a.defaultOrder - b.defaultOrder;
    });

    // 2. Find target index
    const targetKeys = getWidgetConfigKeys(widgetId);
    const oldIndex = widgets.findIndex(w => w.orderKey === targetKeys.order);
    if (oldIndex === -1) return;

    const [targetItem] = widgets.splice(oldIndex, 1);

    // 3. Clamp new order/index between 0 and 8
    const clampedNewOrder = Math.max(0, Math.min(widgets.length, newOrder));

    // 4. Insert at new position
    widgets.splice(clampedNewOrder, 0, targetItem);

    // 5. Build updates object mapping each orderKey under tabs.networks
    const networksUpdates: Record<string, number> = {};
    widgets.forEach((w, index) => {
      networksUpdates[w.orderKey] = index;
    });

    await updateConfig({
      tabs: {
        ...config?.settings?.tabs,
        networks: {
          ...config?.settings?.tabs?.networks,
          ...networksUpdates
        }
      }
    });
  };

  return (
    <SettingsSection 
      title="📶 Paramètres Spécifiques (Réseaux)"
      description="Disposition sur l'onglet Réseaux"
      isOpen={isOpen}
      onToggle={onToggle}
    >
      <div className="nd-settings-card" style={{ padding: '14px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--nd-card-border)', borderRadius: 'var(--nd-card-radius)' }}>
        <h4 style={{ margin: '0 0 8px 0', fontSize: '0.8rem', fontWeight: 600 }}>Ordre de priorité verticale</h4>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button 
            onClick={() => handleOrder(Math.max(0, orderValue - 1))}
            style={{ width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--nd-card-border)', borderRadius: 'var(--nd-card-radius)', color: 'var(--nd-text)', cursor: 'pointer', fontSize: '1rem', fontWeight: 'bold' }}
          >
            -
          </button>
          <input
            type="number"
            className="nd-input"
            min="0"
            max="8"
            value={orderValue}
            onChange={(e) => handleOrder(Number(e.target.value))}
            style={{ flex: 1, height: '32px', fontSize: '0.8rem', textAlign: 'center', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--nd-card-border)', color: 'var(--nd-text)', borderRadius: 'var(--nd-card-radius)' }}
          />
          <button 
            onClick={() => handleOrder(orderValue + 1)}
            style={{ width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--nd-card-border)', borderRadius: 'var(--nd-card-radius)', color: 'var(--nd-text)', cursor: 'pointer', fontSize: '1rem', fontWeight: 'bold' }}
          >
            +
          </button>
        </div>
      </div>
    </SettingsSection>
  );
}
