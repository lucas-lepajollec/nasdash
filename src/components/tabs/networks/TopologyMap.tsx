import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Sparkles } from 'lucide-react';
import { useConfig } from '@/hooks/useConfig';
import { NetworkNode, NetworkGroup, NetworkConnection, NetworkTopology } from '@/lib/types';
import ConfirmModal from '../../modals/ConfirmModal';
import EmojiPickerModal from '../../modals/EmojiPickerModal';
import CustomSelect from '../../shared/CustomSelect';
import { Emoji } from '../../shared/Emoji';
import { useDialogAccessibility } from '@/hooks/useDialogAccessibility';
import { useI18n } from '@/i18n/I18nProvider';
import { CalmeCheckRow, CalmeDialog, CalmeField } from '@/components/shared/CalmeDialog';
import { CalmeRow, CalmeSegmented, CalmeSwitch } from '@/components/modals/settings/shared/CalmeControls';
import { TopologyCanvas } from './TopologyCanvas';

interface TopologyMapProps {
  editMode: boolean;
  searchQuery: string;
  showSensitive: boolean;
}

export function TopologyMap({ editMode, searchQuery, showSensitive }: TopologyMapProps) {
  const { t } = useI18n();
  const { config, updateConfig, showSecretSections } = useConfig();
  const [mounted, setMounted] = useState(false);
  // Dialogs are portalled to the body once mounted in the browser.
  useEffect(() => { setMounted(true); }, []); // eslint-disable-line react-hooks/set-state-in-effect

  // Modals / forms state
  const [showAddNode, setShowAddNode] = useState(false);
  const [showAddGroup, setShowAddGroup] = useState(false);
  const [showAddLink, setShowAddLink] = useState(false);
  const [showIconPicker, setShowIconPicker] = useState(false);

  // Element selections for editing/deletions
  const [editingNode, setEditingNode] = useState<NetworkNode | null>(null);
  const [editingGroup, setEditingGroup] = useState<NetworkGroup | null>(null);
  const [editingConnection, setEditingConnection] = useState<NetworkConnection | null>(null);
  const [pendingDeleteNode, setPendingDeleteNode] = useState<NetworkNode | null>(null);
  const [pendingDeleteGroup, setPendingDeleteGroup] = useState<NetworkGroup | null>(null);

  // New Node Form fields
  const [nodeName, setNodeName] = useState('');
  const [nodeType, setNodeType] = useState<NetworkNode['type']>('stdsvc');
  const [nodeIcon, setNodeIcon] = useState('📦');
  const [nodeIp, setNodeIp] = useState('');
  const [nodePorts, setNodePorts] = useState('');
  const [nodeGroupId, setNodeGroupId] = useState('');
  const [linkedServiceId, setLinkedServiceId] = useState('');
  const [linkedDeviceId, setLinkedDeviceId] = useState('');

  // New Group Form fields
  const [groupName, setGroupName] = useState('');
  const [groupType, setGroupType] = useState<NetworkGroup['type']>('device');
  const [selectedNodeIds, setSelectedNodeIds] = useState<string[]>([]);
  const [mergeIncomingLinks, setMergeIncomingLinks] = useState(false);

  // Auto-import options
  const [showAutoImportModal, setShowAutoImportModal] = useState(false);
  const [autoImportGroupCategories, setAutoImportGroupCategories] = useState(true);
  const nodeDialogRef = useDialogAccessibility(
    () => editingNode ? setEditingNode(null) : setShowAddNode(false),
    Boolean(showAddNode || editingNode),
  );
  const groupDialogRef = useDialogAccessibility(
    () => editingGroup ? setEditingGroup(null) : setShowAddGroup(false),
    Boolean(showAddGroup || editingGroup),
  );
  const connectionDialogRef = useDialogAccessibility(
    () => editingConnection ? setEditingConnection(null) : setShowAddLink(false),
    Boolean(showAddLink || editingConnection),
  );
  const autoImportDialogRef = useDialogAccessibility(
    () => setShowAutoImportModal(false),
    showAutoImportModal,
  );

  // New Connection Form fields
  const [linkFrom, setLinkFrom] = useState('');
  const [linkTo, setLinkTo] = useState('');
  const [linkLabel, setLinkLabel] = useState('');
  const [linkDir, setLinkDir] = useState<'directional' | 'bidirectional'>('directional');
  const [linkFromPort, setLinkFromPort] = useState<'auto' | 'top' | 'bottom' | 'left' | 'right'>('auto');
  const [linkToPort, setLinkToPort] = useState<'auto' | 'top' | 'bottom' | 'left' | 'right'>('auto');

  // Listen for edit action toolbar events dispatched from the Header. Keep
  // this effect below every state declaration it references so React's static
  // analysis and future compiler passes can reason about it safely.
  useEffect(() => {
    const onAddGroup = () => {
      setGroupName('');
      setGroupType('infra');
      setSelectedNodeIds([]);
      setMergeIncomingLinks(false);
      setShowAddGroup(true);
    };
    const onAddLink = () => {
      setLinkFrom('');
      setLinkTo('');
      setLinkLabel('');
      setLinkDir('directional');
      setLinkFromPort('auto');
      setLinkToPort('auto');
      setShowAddLink(true);
    };
    const onAddNode = () => {
      setNodeName('');
      setNodeType('stdsvc');
      setNodeIcon('📦');
      setNodeIp('');
      setNodePorts('');
      setNodeGroupId('');
      setLinkedServiceId('');
      setLinkedDeviceId('');
      setShowAddNode(true);
    };

    window.addEventListener('networkActionAddGroup', onAddGroup);
    window.addEventListener('networkActionAddLink', onAddLink);
    window.addEventListener('networkActionAddNode', onAddNode);

    return () => {
      window.removeEventListener('networkActionAddGroup', onAddGroup);
      window.removeEventListener('networkActionAddLink', onAddLink);
      window.removeEventListener('networkActionAddNode', onAddNode);
    };
  }, []);

  // Retrieve current topology data from settings (with defaults if empty)
  const rawTopology: NetworkTopology = useMemo(() => {
    return config?.settings?.networkTopology || { nodes: [], groups: [], connections: [] };
  }, [config?.settings?.networkTopology]);

  // Compute secret categories and services maps
  const secretData = useMemo(() => {
    if (!config?.categories) {
      return { serviceIds: new Set<string>(), serviceNames: new Set<string>(), categoryTitles: new Set<string>() };
    }
    const serviceIds = new Set<string>();
    const serviceNames = new Set<string>();
    const categoryTitles = new Set<string>();

    config.categories.forEach(c => {
      if (c.isSecret) {
        categoryTitles.add(c.title.toLowerCase().trim());
        c.services.forEach(s => {
          serviceIds.add(s.id);
          serviceNames.add(s.name.toLowerCase().trim());
        });
      }
    });

    return { serviceIds, serviceNames, categoryTitles };
  }, [config?.categories]);

  // Local address of each linked service: the map cards open it.
  const serviceUrls = useMemo(() => {
    const urls = new Map<string, string>();
    for (const category of config?.categories ?? []) for (const service of category.services) if (service.localUrl) urls.set(service.id, service.localUrl);
    return urls;
  }, [config?.categories]);

  // Apply filtering based on showSecretSections state
  const topology = useMemo(() => {
    if (showSecretSections) return rawTopology;

    const { serviceIds, serviceNames, categoryTitles } = secretData;

    // Filter nodes
    const filteredNodes = rawTopology.nodes.filter(node => {
      if (node.linkedServiceId && serviceIds.has(node.linkedServiceId)) {
        return false;
      }
      if (node.name && serviceNames.has(node.name.toLowerCase().trim())) {
        return false;
      }
      return true;
    });

    const visibleNodeIds = new Set(filteredNodes.map(n => n.id));

    // Filter groups
    const filteredGroups = rawTopology.groups.filter(group => {
      if (group.name && categoryTitles.has(group.name.toLowerCase().trim())) {
        return false;
      }
      return true;
    });

    const visibleGroupIds = new Set(filteredGroups.map(g => g.id));

    // Filter connections: only keep connections where both endpoints are visible
    const filteredConnections = rawTopology.connections.filter(conn => {
      const fromVisible = visibleNodeIds.has(conn.fromId) || visibleGroupIds.has(conn.fromId);
      const toVisible = visibleNodeIds.has(conn.toId) || visibleGroupIds.has(conn.toId);
      return fromVisible && toVisible;
    });

    return {
      nodes: filteredNodes,
      groups: filteredGroups,
      connections: filteredConnections
    };
  }, [rawTopology, showSecretSections, secretData]);

  // Resolve card size based on configuration or auto-detection
  const cardSizeSetting = config?.settings?.tabs?.networks?.cardSize || 'auto';

  // Auto-import generator: creates nodes based on NasDash config
  const handleAutoImport = async (useHomeCategories: boolean) => {
    if (!config) return;

    const nodes: NetworkNode[] = [];
    const groups: NetworkGroup[] = [];
    const connections: NetworkConnection[] = [];

    // Helper to generate a random ID
    const genId = () => Math.random().toString(36).substring(2, 9);

    // 1. Create a default Switch / Box in Infra Column
    const infraSwitchId = `auto-sw-${genId()}`;
    nodes.push({
      id: infraSwitchId,
      name: 'Switch Principal / Box',
      type: 'infra',
      icon: '🌐',
      ip: '192.168.1.1',
      ports: [80, 443]
    });

    // 2. Import Devices as hosts
    const deviceMap = new Map<string, string>(); // NasDash deviceId -> Node Id
    const deviceIpMap = new Map<string, string>(); // Hostname/IP -> Node Id

    (config.devices || []).forEach(d => {
      const nodeId = `auto-dev-${genId()}`;
      deviceMap.set(d.id, nodeId);

      const ip = d.api?.ip || d.host || '';
      if (ip) {
        deviceIpMap.set(ip.trim(), nodeId);
      }

      nodes.push({
        id: nodeId,
        name: d.name,
        type: 'device',
        icon: d.icon || '🖥️',
        ip: ip,
        linkedDeviceId: d.id
      });

      // Connect each device to the main Switch/Box
      connections.push({
        id: `auto-conn-${genId()}`,
        fromId: infraSwitchId,
        toId: nodeId,
        type: 'bidirectional'
      });
    });

    // 3. Scan services to distinguish between Network Services and Standard Apps
    const netKeywords = ['pihole', 'pi-hole', 'adguard', 'tailscale', 'wireguard', 'vpn', 'dns', 'tunnel', 'cloudflare', 'traefik', 'proxy', 'nginx', 'npm'];

    (config.categories || []).forEach(cat => {
      let groupStdId = '';
      let groupNetId = '';

      if (useHomeCategories && cat.services.length > 0) {
        // Find if there are standard or network services inside this category
        const hasStd = cat.services.some(svc => {
          const nameLower = svc.name.toLowerCase();
          const catLower = cat.title.toLowerCase();
          return !netKeywords.some(kw => nameLower.includes(kw) || catLower.includes(kw));
        });
        const hasNet = cat.services.some(svc => {
          const nameLower = svc.name.toLowerCase();
          const catLower = cat.title.toLowerCase();
          return netKeywords.some(kw => nameLower.includes(kw) || catLower.includes(kw));
        });

        if (hasStd) {
          groupStdId = `auto-grp-std-${genId()}`;
          groups.push({
            id: groupStdId,
            name: cat.title,
            type: 'stdsvc',
            mergeIncomingLinks: true
          });
        }
        if (hasNet) {
          groupNetId = `auto-grp-net-${genId()}`;
          groups.push({
            id: groupNetId,
            name: cat.title,
            type: 'netsvc',
            mergeIncomingLinks: true
          });
        }
      }

      cat.services.forEach(svc => {
        const nameLower = svc.name.toLowerCase();
        const catLower = cat.title.toLowerCase();
        const isNet = netKeywords.some(kw => nameLower.includes(kw) || catLower.includes(kw));
        const nodeId = `auto-svc-${genId()}`;

        // Parse IP/Host if available
        let hostIp = '';
        let portNum: number | undefined;

        if (svc.localUrl) {
          try {
            const urlObj = new URL(svc.localUrl.match(/^https?:\/\//i) ? svc.localUrl : `http://${svc.localUrl}`);
            hostIp = urlObj.hostname;
            if (urlObj.port) portNum = parseInt(urlObj.port, 10);
          } catch(e) {}
        }

        const assignedGroupId = isNet ? groupNetId : groupStdId;

        nodes.push({
          id: nodeId,
          name: svc.name,
          type: isNet ? 'netsvc' : 'stdsvc',
          icon: isNet ? '🛡️' : '📦',
          ip: hostIp,
          ports: portNum ? [portNum] : [],
          linkedServiceId: svc.id,
          groupId: assignedGroupId || undefined
        });

        // Smart-link service to its Device host if IPs match
        let linkedToHost = false;
        if (hostIp) {
          const deviceNodeId = deviceIpMap.get(hostIp.trim());
          if (deviceNodeId) {
            connections.push({
              id: `auto-conn-${genId()}`,
              fromId: deviceNodeId,
              toId: nodeId,
              type: 'directional'
            });
            linkedToHost = true;
          }
        }

        // Otherwise connect it to the main router/switch
        if (!linkedToHost) {
          connections.push({
            id: `auto-conn-${genId()}`,
            fromId: infraSwitchId,
            toId: nodeId,
            type: 'directional'
          });
        }
      });
    });

    // 4. Merge connections pointing to nodes in the same category group
    groups.forEach(g => {
      // Find nodes belonging to this group
      const groupNodeIds = nodes.filter(n => n.groupId === g.id).map(n => n.id);
      if (groupNodeIds.length === 0) return;

      // Find all incoming connections from outside the group targeting nodes inside the group
      const incoming = connections.filter(c =>
        groupNodeIds.includes(c.toId) && !groupNodeIds.includes(c.fromId)
      );

      if (incoming.length > 0) {
        // Group incoming by fromId
        const groupedByFrom: Record<string, typeof incoming> = {};
        incoming.forEach(c => {
          if (!groupedByFrom[c.fromId]) groupedByFrom[c.fromId] = [];
          groupedByFrom[c.fromId].push(c);
        });

        // Remove these incoming connections from the connections list
        const incomingIds = new Set(incoming.map(c => c.id));
        for (let i = connections.length - 1; i >= 0; i--) {
          if (incomingIds.has(connections[i].id)) {
            connections.splice(i, 1);
          }
        }

        // Add a single consolidated connection for each fromId to the groupId
        Object.entries(groupedByFrom).forEach(([fromId, conns]) => {
          const labels = conns.map(c => c.label?.trim()).filter(Boolean) as string[];
          const uniqueLabels = Array.from(new Set(labels));
          const mergedLabel = uniqueLabels.length > 0 ? uniqueLabels.join(', ') : undefined;
          const hasBidirectional = conns.some(c => c.type === 'bidirectional');

          connections.push({
            id: `auto-conn-${genId()}`,
            fromId,
            toId: g.id,
            type: hasBidirectional ? 'bidirectional' : 'directional',
            label: mergedLabel
          });
        });
      }
    });

    // Update settings
    await updateConfig({
      networkTopology: {
        nodes,
        groups,
        connections
      }
    });

  };

  // Save updated topology back to settings
  const saveTopology = async (updated: NetworkTopology) => {
    await updateConfig({
      networkTopology: updated
    });
  };

  // Node creation
  const handleCreateNode = () => {
    if (!nodeName.trim()) return;

    const parsedPorts = nodePorts
      .split(',')
      .map(p => parseInt(p.trim(), 10))
      .filter(p => !isNaN(p));

    let updatedNodes = [...topology.nodes];

    if (editingNode) {
      updatedNodes = updatedNodes.map(n => n.id === editingNode.id ? {
        ...n,
        name: nodeName,
        type: nodeType,
        icon: nodeIcon,
        ip: nodeIp || undefined,
        ports: parsedPorts.length > 0 ? parsedPorts : undefined,
        groupId: nodeGroupId || undefined,
        linkedServiceId: linkedServiceId || undefined,
        linkedDeviceId: linkedDeviceId || undefined
      } : n);
    } else {
      const newNode: NetworkNode = {
        id: `node-${Math.random().toString(36).substring(2, 9)}`,
        name: nodeName,
        type: nodeType,
        icon: nodeIcon,
        ip: nodeIp || undefined,
        ports: parsedPorts.length > 0 ? parsedPorts : undefined,
        groupId: nodeGroupId || undefined,
        linkedServiceId: linkedServiceId || undefined,
        linkedDeviceId: linkedDeviceId || undefined
      };
      updatedNodes.push(newNode);
    }

    const updated = {
      ...topology,
      nodes: updatedNodes
    };

    saveTopology(updated);
    setShowAddNode(false);
    setEditingNode(null);

    // Reset form
    setNodeName('');
    setNodeType('stdsvc');
    setNodeIcon('📦');
    setNodeIp('');
    setNodePorts('');
    setNodeGroupId('');
    setLinkedServiceId('');
    setLinkedDeviceId('');
  };

  // Group creation
  const handleCreateGroup = () => {
    if (!groupName.trim()) return;

    let groupId = editingGroup?.id;
    let updatedGroups = [...topology.groups];

    if (editingGroup) {
      updatedGroups = updatedGroups.map(g => g.id === editingGroup.id ? {
        ...g,
        name: groupName,
        type: groupType
      } : g);
    } else {
      groupId = `group-${Math.random().toString(36).substring(2, 9)}`;
      const newGroup: NetworkGroup = {
        id: groupId,
        name: groupName,
        type: groupType
      };
      updatedGroups.push(newGroup);
    }

    // Associate checked nodes to this group, and disassociate nodes that were in this group but are unchecked
    const updatedNodes = topology.nodes.map(n => {
      if (selectedNodeIds.includes(n.id)) {
        return { ...n, groupId };
      } else if (n.groupId === groupId) {
        return { ...n, groupId: undefined };
      }
      return n;
    });

    // Handle merging of incoming connections
    let updatedConnections = [...topology.connections];
    if (mergeIncomingLinks) {
      // Find all incoming connections from outside the group targeting nodes inside the group
      const incoming = topology.connections.filter(c =>
        selectedNodeIds.includes(c.toId) && !selectedNodeIds.includes(c.fromId)
      );

      // Group incoming by fromId
      const groupedByFrom: Record<string, NetworkConnection[]> = {};
      incoming.forEach(c => {
        if (!groupedByFrom[c.fromId]) groupedByFrom[c.fromId] = [];
        groupedByFrom[c.fromId].push(c);
      });

      // Remove all these incoming connections
      const incomingIds = new Set(incoming.map(c => c.id));
      updatedConnections = updatedConnections.filter(c => !incomingIds.has(c.id));

      // Add a single consolidated connection for each fromId
      Object.entries(groupedByFrom).forEach(([fromId, conns]) => {
        const labels = conns.map(c => c.label?.trim()).filter(Boolean) as string[];
        const uniqueLabels = Array.from(new Set(labels));
        const mergedLabel = uniqueLabels.length > 0 ? uniqueLabels.join(', ') : undefined;
        const hasBidirectional = conns.some(c => c.type === 'bidirectional');

        updatedConnections.push({
          id: `conn-${Math.random().toString(36).substring(2, 9)}`,
          fromId,
          toId: groupId!,
          type: hasBidirectional ? 'bidirectional' : 'directional',
          label: mergedLabel
        });
      });
    }

    const updated = {
      nodes: updatedNodes,
      groups: updatedGroups,
      connections: updatedConnections
    };

    saveTopology(updated);
    setShowAddGroup(false);
    setEditingGroup(null);
    setGroupName('');
    setSelectedNodeIds([]);
    setMergeIncomingLinks(false);
  };

  // Link creation
  const handleCreateLink = () => {
    if (!linkFrom || !linkTo || linkFrom === linkTo) return;

    let updatedConnections = [...topology.connections];

    if (editingConnection) {
      updatedConnections = updatedConnections.map(c => c.id === editingConnection.id ? {
        ...c,
        fromId: linkFrom,
        toId: linkTo,
        label: linkLabel || undefined,
        type: linkDir,
        fromPort: linkFromPort,
        toPort: linkToPort
      } : c);
    } else {
      const newConn: NetworkConnection = {
        id: `conn-${Math.random().toString(36).substring(2, 9)}`,
        fromId: linkFrom,
        toId: linkTo,
        label: linkLabel || undefined,
        type: linkDir,
        fromPort: linkFromPort,
        toPort: linkToPort
      };
      updatedConnections.push(newConn);
    }

    const updated = {
      ...topology,
      connections: updatedConnections
    };

    saveTopology(updated);
    setShowAddLink(false);
    setEditingConnection(null);
    setLinkFrom('');
    setLinkTo('');
    setLinkLabel('');
    setLinkDir('directional');
    setLinkFromPort('auto');
    setLinkToPort('auto');
  };

  // Deletion helper
  const handleDeleteNode = (id: string) => {
    const updated = {
      nodes: topology.nodes.filter(n => n.id !== id),
      groups: topology.groups,
      connections: topology.connections.filter(c => c.fromId !== id && c.toId !== id)
    };
    saveTopology(updated);
    setPendingDeleteNode(null);
  };

  const handleDeleteGroup = (id: string) => {
    const updated = {
      nodes: topology.nodes.map(n => n.groupId === id ? { ...n, groupId: undefined } : n),
      groups: topology.groups.filter(g => g.id !== id),
      connections: topology.connections.filter(c => c.fromId !== id && c.toId !== id)
    };
    saveTopology(updated);
    setPendingDeleteGroup(null);
  };

  const handleDeleteConnection = (id: string) => {
    const updated = {
      ...topology,
      connections: topology.connections.filter(c => c.id !== id)
    };
    saveTopology(updated);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: 12 }}>

      {/* Empty state importer trigger */}
      {topology.nodes.length === 0 && (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '0 4px', marginBottom: 12 }}>
          <button
            className="nd-btn"
            onClick={() => {
              setAutoImportGroupCategories(true);
              setShowAutoImportModal(true);
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '6px 12px',
              fontSize: '0.72rem',
              borderColor: 'var(--nd-accent)',
              background: 'var(--nd-accent-glow)',
              color: 'var(--nd-accent)',
              fontWeight: 700
            }}
          >
            <Sparkles size={13} />
            <span>{t("Générer la carte automatiquement")}</span>
          </button>
        </div>
      )}

      {/* The map: laid out and routed by ELK (TopologyCanvas). */}
      <div className="nd-topology-canvas" style={{ position: 'relative', flex: 1, minHeight: 240, padding: 12, borderRadius: 'var(--nd-card-radius)' }}>
        <TopologyCanvas
          topology={topology}
          serviceUrls={serviceUrls}
          editMode={editMode}
          searchQuery={searchQuery}
          showSensitive={showSensitive}
          cardSize={cardSizeSetting as 'auto' | 'standard' | 'compact' | 'mini'}
          onEditNode={n => {
            setEditingNode(n);
            setNodeName(n.name);
            setNodeType(n.type);
            setNodeIcon(n.icon);
            setNodeIp(n.ip || '');
            setNodePorts(n.ports ? n.ports.join(', ') : '');
            setNodeGroupId(n.groupId || '');
            setLinkedDeviceId(n.linkedDeviceId || '');
            setLinkedServiceId(n.linkedServiceId || '');
          }}
          onEditGroup={g => {
            setEditingGroup(g);
            setGroupName(g.name);
            setGroupType(g.type);
            setSelectedNodeIds(topology.nodes.filter(n => n.groupId === g.id).map(n => n.id));
            setMergeIncomingLinks(false);
          }}
          onEditConnection={conn => {
            setEditingConnection(conn);
            setLinkFrom(conn.fromId);
            setLinkTo(conn.toId);
            setLinkLabel(conn.label || '');
            setLinkDir(conn.type || 'directional');
            setLinkFromPort(conn.fromPort || 'auto');
            setLinkToPort(conn.toPort || 'auto');
          }}
          onConnect={(fromId, toId) => {
            setLinkFrom(fromId);
            setLinkTo(toId);
            setLinkLabel('');
            setLinkDir('directional');
            setLinkFromPort('auto');
            setLinkToPort('auto');
            setShowAddLink(true);
          }}
        />
      </div>

      {/* ======================================================================
          FORM MODAL: ADD / EDIT NODE
         ====================================================================== */}
      {(showAddNode || editingNode) && mounted && typeof document !== 'undefined' && createPortal(
        <div className="nd-modal-overlay" onMouseDown={(e) => e.target === e.currentTarget && (editingNode ? setEditingNode(null) : setShowAddNode(false))}>
          <CalmeDialog
            dialogRef={nodeDialogRef}
            label={editingNode ? t("Modifier le nœud") : t("Ajouter un nœud topologique")}
            title={editingNode ? t("Modifier le nœud") : t('topology.calme.newNode')}
            onClose={() => editingNode ? setEditingNode(null) : setShowAddNode(false)}
            danger={editingNode && (
              <button type="button" className="nd-btn ndc-danger-ghost" onClick={() => { setPendingDeleteNode(editingNode); setEditingNode(null); }}>{t("Supprimer")}</button>
            )}
            footer={<>
              <button type="button" className="nd-btn" onClick={() => editingNode ? setEditingNode(null) : setShowAddNode(false)}>{t("Annuler")}</button>
              <button type="button" className="nd-btn nd-btn-accent" onClick={handleCreateNode}>{editingNode ? t("Enregistrer") : t("Ajouter")}</button>
            </>}
          >
            <div className="ndc-field-inline">
              <button type="button" className="ndc-icon-pick" onClick={() => setShowIconPicker(true)} title={t("Choisir une icône")} aria-label={t("Choisir une icône")}>
                <Emoji emoji={nodeIcon || '📦'} />
              </button>
              <CalmeField label={t("Nom du Nœud")} htmlFor="topology-node-name">
                <input id="topology-node-name" className="nd-input" value={nodeName} onChange={e => setNodeName(e.target.value)} placeholder={t("Ex: Proxmox Hypervisor, DNS local...")} />
              </CalmeField>
            </div>
            <CalmeField label={t("Type / Catégorie")}>
              <CalmeSegmented label={t("Type / Catégorie")} value={nodeType} onChange={(val) => setNodeType(val)} options={[
                  { value: 'infra', label: t('topology.calme.infra') },
                  { value: 'device', label: t('topology.calme.machines') },
                  { value: 'netsvc', label: t('topology.calme.network') },
                  { value: 'stdsvc', label: t('topology.calme.apps') },
                ]} />
            </CalmeField>
            <div className="ndc-field-grid">
              <CalmeField label={t("Adresse IP")}>
                <input className="nd-input" value={nodeIp} onChange={e => setNodeIp(e.target.value)} placeholder="192.168.1.100" />
              </CalmeField>
              <CalmeField label={t('topology.calme.ports')} info={t("Port(s) (sép. virgule)")}>
                <input className="nd-input" value={nodePorts} onChange={e => setNodePorts(e.target.value)} placeholder="80, 443" />
              </CalmeField>
            </div>
            <CalmeField label={t('topology.calme.group')} info={t("Associer à un groupe (sous-catégorie)")}>
              <CustomSelect
                value={nodeGroupId}
                onChange={setNodeGroupId}
                options={[
                  { value: '', label: t("-- Aucun groupe --") },
                  ...topology.groups.filter(g => g.type === nodeType).map(g => ({ value: g.id, label: g.name }))
                ]}
              />
            </CalmeField>
            <div className="ndc-field-grid">
              <CalmeField label={t('topology.calme.linkDevice')} info={t('topology.calme.linkInfo')}>
                <CustomSelect
                  value={linkedDeviceId}
                  onChange={(val) => {
                    setLinkedDeviceId(val);
                    const dev = config?.devices?.find(d => d.id === val);
                    if (dev) {
                      setNodeName(dev.name);
                      setNodeIcon(dev.icon || '🖥️');
                      setNodeIp(dev.api?.ip || dev.host || '');
                      setNodeType('device');
                    }
                  }}
                  options={[{ value: '', label: t("-- Aucun --") }, ...(config?.devices || []).map(d => ({ value: d.id, label: d.name }))]}
                />
              </CalmeField>
              <CalmeField label={t('topology.calme.linkService')} info={t('topology.calme.linkInfo')}>
                <CustomSelect
                  value={linkedServiceId}
                  onChange={(val) => {
                    setLinkedServiceId(val);
                    const svc = config?.categories.flatMap(c => c.services).find(s => s.id === val);
                    if (svc) {
                      setNodeName(svc.name);
                      setNodeIcon('📦');
                      setNodeType('stdsvc');
                      if (svc.localUrl) {
                        try {
                          const u = new URL(svc.localUrl.startsWith('http') ? svc.localUrl : `http://${svc.localUrl}`);
                          setNodeIp(u.hostname);
                          if (u.port) setNodePorts(u.port);
                        } catch { /* not an address */ }
                      }
                    }
                  }}
                  options={[{ value: '', label: t("-- Aucun --") }, ...(config?.categories.flatMap(c => c.services).map(s => ({ value: s.id, label: s.name })) || [])]}
                />
              </CalmeField>
            </div>
          </CalmeDialog>
        </div>,
        document.body
      )}

      {/* ======================================================================
          FORM MODAL: ADD / EDIT GROUP
         ====================================================================== */}
      {(showAddGroup || editingGroup) && mounted && typeof document !== 'undefined' && createPortal(
        <div className="nd-modal-overlay" onMouseDown={(e) => e.target === e.currentTarget && (editingGroup ? setEditingGroup(null) : setShowAddGroup(false))}>
          <CalmeDialog
            dialogRef={groupDialogRef}
            label={editingGroup ? t("Modifier le groupe") : t("Créer un groupe de nœuds")}
            title={editingGroup ? t("Modifier le groupe") : t("Créer un groupe de nœuds")}
            onClose={() => editingGroup ? setEditingGroup(null) : setShowAddGroup(false)}
            danger={editingGroup && (
              <button type="button" className="nd-btn ndc-danger-ghost" onClick={() => { setPendingDeleteGroup(editingGroup); setEditingGroup(null); }}>{t("Supprimer")}</button>
            )}
            footer={<>
              <button type="button" className="nd-btn" onClick={() => editingGroup ? setEditingGroup(null) : setShowAddGroup(false)}>{t("Annuler")}</button>
              <button type="button" className="nd-btn nd-btn-accent" onClick={handleCreateGroup}>{editingGroup ? t("Enregistrer") : t("Créer")}</button>
            </>}
          >
            <CalmeField label={t("Nom du groupe")} htmlFor="topology-group-name">
              <input id="topology-group-name" className="nd-input" value={groupName} onChange={e => setGroupName(e.target.value)} placeholder={t("Ex: Grappe PVE, Cluster Docker...")} />
            </CalmeField>
            <CalmeField label={t("Colonne / Catégorie cible")}>
              <CalmeSegmented label={t("Colonne / Catégorie cible")} value={groupType} onChange={(val) => { setGroupType(val); setSelectedNodeIds([]); }} options={[
                  { value: 'infra', label: t('topology.calme.infra') },
                  { value: 'device', label: t('topology.calme.machines') },
                  { value: 'netsvc', label: t('topology.calme.network') },
                  { value: 'stdsvc', label: t('topology.calme.apps') },
                ]} />
            </CalmeField>
            <CalmeField label={t("Nœuds à inclure dans ce groupe")}>
              <div className="ndc-check-list">
                {topology.nodes.filter(n => n.type === groupType).length === 0
                  ? <div className="ndc-set-empty">{t("Aucun nœud dans cette catégorie")}</div>
                  : topology.nodes.filter(n => n.type === groupType).map(n => (
                    <CalmeCheckRow key={n.id} checked={selectedNodeIds.includes(n.id)} onChange={() => setSelectedNodeIds(prev => prev.includes(n.id) ? prev.filter(id => id !== n.id) : [...prev, n.id])}>
                      <Emoji emoji={n.icon} /> {n.name}
                    </CalmeCheckRow>
                  ))}
              </div>
            </CalmeField>
            {selectedNodeIds.length > 0 && (
              <CalmeRow label={t('topology.calme.mergeLinks')} info={t("Redirige les connexions arrivant sur les éléments de ce groupe vers le groupe lui-même en les fusionnant (ex: ports multiples).")}>
                <CalmeSwitch label={t('topology.calme.mergeLinks')} checked={mergeIncomingLinks} onChange={setMergeIncomingLinks} />
              </CalmeRow>
            )}
          </CalmeDialog>
        </div>,
        document.body
      )}

      {/* ======================================================================
          FORM MODAL: ADD / EDIT CONNECTION (LIAISON)
         ====================================================================== */}
      {(showAddLink || editingConnection) && mounted && typeof document !== 'undefined' && createPortal(
        <div className="nd-modal-overlay" onMouseDown={(e) => e.target === e.currentTarget && (editingConnection ? setEditingConnection(null) : setShowAddLink(false))}>
          <CalmeDialog
            dialogRef={connectionDialogRef}
            label={editingConnection ? t("Modifier la liaison") : t("Nouvelle liaison réseau")}
            title={editingConnection ? t("Modifier la liaison") : t("Nouvelle liaison réseau")}
            width={500}
            onClose={() => { if (editingConnection) setEditingConnection(null); else setShowAddLink(false); }}
            danger={editingConnection && (
              <button type="button" className="nd-btn ndc-danger-ghost" onClick={() => { handleDeleteConnection(editingConnection.id); setEditingConnection(null); }}>{t("Supprimer")}</button>
            )}
            footer={<>
              <button
                type="button"
                className="nd-btn"
                onClick={() => {
                  if (editingConnection) setEditingConnection(null);
                  else setShowAddLink(false);
                  setLinkFrom(''); setLinkTo(''); setLinkLabel(''); setLinkDir('directional'); setLinkFromPort('auto'); setLinkToPort('auto');
                }}
              >{t("Annuler")}</button>
              <button type="button" className="nd-btn nd-btn-accent" onClick={handleCreateLink} disabled={!linkFrom || !linkTo}>{editingConnection ? t("Enregistrer") : t("Créer la liaison")}</button>
            </>}
          >
            {(() => {
              const from = topology.nodes.find(n => n.id === linkFrom) ?? topology.groups.find(g => g.id === linkFrom);
              const to = topology.nodes.find(n => n.id === linkTo) ?? topology.groups.find(g => g.id === linkTo);
              const iconOf = (item: typeof from) => (item && 'icon' in item && item.icon) || '📦';
              return (
                <div className="ndc-flow" aria-hidden="true">
                  <span className={from ? undefined : 'ndc-flow-empty'}>{from ? <><Emoji emoji={iconOf(from)} /> {from.name}</> : t("Source ?")}</span>
                  <span className="ndc-flow-arrow">{linkDir === 'bidirectional' ? '↔' : '→'}</span>
                  <span className={to ? undefined : 'ndc-flow-empty'}>{to ? <><Emoji emoji={iconOf(to)} /> {to.name}</> : t("Cible ?")}</span>
                </div>
              );
            })()}
            <div className="ndc-field-grid">
              <CalmeField label={t("Source (Départ)")}>
                <CustomSelect
                  value={linkFrom}
                  onChange={setLinkFrom}
                  disabled={!!editingConnection}
                  options={[{ value: '', label: t("-- Sélectionner --") }, ...topology.nodes.map(n => ({ value: n.id, label: [n.icon, n.name].join(' ') })), ...topology.groups.map(g => ({ value: g.id, label: ['📦', g.name].join(' ') }))]}
                />
              </CalmeField>
              <CalmeField label={t("Cible (Arrivée)")}>
                <CustomSelect
                  value={linkTo}
                  onChange={setLinkTo}
                  disabled={!!editingConnection}
                  options={[{ value: '', label: t("-- Sélectionner --") }, ...topology.nodes.filter(n => n.id !== linkFrom).map(n => ({ value: n.id, label: [n.icon, n.name].join(' ') })), ...topology.groups.filter(g => g.id !== linkFrom).map(g => ({ value: g.id, label: ['📦', g.name].join(' ') }))]}
                />
              </CalmeField>
            </div>
            <div className="ndc-field-grid">
              <CalmeField label={t("Libellé (optionnel)")}>
                <input className="nd-input" value={linkLabel} onChange={e => setLinkLabel(e.target.value)} placeholder={t("Ex: 443, HTTP, Tunnel...")} />
              </CalmeField>
              <CalmeField label={t("Type de flux")}>
                <CalmeSegmented label={t("Type de flux")} value={linkDir} onChange={(val) => setLinkDir(val)} options={[{ value: 'directional', label: t('topology.calme.oneWay') }, { value: 'bidirectional', label: t('topology.calme.twoWay') }]} />
              </CalmeField>
            </div>
            <div className="ndc-field-grid">
              <CalmeField label={t("Point d'attache source")}>
                <CalmeSegmented label={t("Point d'attache source")} value={linkFromPort} onChange={(val) => setLinkFromPort(val)} options={[
                    { value: 'auto', label: t("Auto") },
                    { value: 'top', label: '↑' },
                    { value: 'right', label: '→' },
                    { value: 'bottom', label: '↓' },
                    { value: 'left', label: '←' },
                  ]} />
              </CalmeField>
              <CalmeField label={t("Point d'attache cible")}>
                <CalmeSegmented label={t("Point d'attache cible")} value={linkToPort} onChange={(val) => setLinkToPort(val)} options={[
                    { value: 'auto', label: t("Auto") },
                    { value: 'top', label: '↑' },
                    { value: 'right', label: '→' },
                    { value: 'bottom', label: '↓' },
                    { value: 'left', label: '←' },
                  ]} />
              </CalmeField>
            </div>
          </CalmeDialog>
        </div>,
        document.body
      )}

      {/* ======================================================================
          CONFIRM MODALS: DELETIONS
         ====================================================================== */}
      {pendingDeleteNode && (
        <ConfirmModal
          isOpen={!!pendingDeleteNode}
          onClose={() => setPendingDeleteNode(null)}
          onConfirm={() => handleDeleteNode(pendingDeleteNode.id)}
          title={t("Supprimer le nœud ?")}
          description={t('confirm.nodeDelete', { name: pendingDeleteNode.name })}
          confirmLabel={t("Supprimer")}
          cancelLabel={t("Annuler")}
        />
      )}

      {pendingDeleteGroup && (
        <ConfirmModal
          isOpen={!!pendingDeleteGroup}
          onClose={() => setPendingDeleteGroup(null)}
          onConfirm={() => handleDeleteGroup(pendingDeleteGroup.id)}
          title={t("Supprimer le groupe ?")}
          description={t('confirm.groupDelete', { name: pendingDeleteGroup.name })}
          confirmLabel={t("Supprimer le groupe")}
          cancelLabel={t("Annuler")}
        />
      )}

      {showIconPicker && (
        <EmojiPickerModal
          initialEmoji={nodeIcon}
          onSelect={(emoji) => {
            setNodeIcon(emoji);
            setShowIconPicker(false);
          }}
          onClose={() => setShowIconPicker(false)}
          allowNone={false}
        />
      )}

      {/* ======================================================================
          FORM MODAL: AUTO-IMPORT CONFIGURATION OPTIONS
         ====================================================================== */}
      {showAutoImportModal && mounted && typeof document !== 'undefined' && createPortal(
        <div className="nd-modal-overlay" onMouseDown={(e) => e.target === e.currentTarget && setShowAutoImportModal(false)}>
          <CalmeDialog
            dialogRef={autoImportDialogRef}
            label={t("Générer la carte réseau automatiquement")}
            title={t('topology.calme.generate')}
            subtitle={t("NasDash va analyser vos appareils et services configurés pour créer automatiquement votre cartographie topologique de départ.")}
            width={420}
            onClose={() => setShowAutoImportModal(false)}
            footer={<>
              <button type="button" className="nd-btn" onClick={() => setShowAutoImportModal(false)}>{t("Annuler")}</button>
              <button type="button" className="nd-btn nd-btn-accent" onClick={async () => { setShowAutoImportModal(false); await handleAutoImport(autoImportGroupCategories); }}>{t("Générer")}</button>
            </>}
          >
            <CalmeRow label={t("Regrouper par catégories du Dashboard")} info={t("Crée automatiquement des groupes basés sur vos catégories d'applications de l'onglet Accueil.")}>
              <CalmeSwitch label={t("Regrouper par catégories du Dashboard")} checked={autoImportGroupCategories} onChange={setAutoImportGroupCategories} />
            </CalmeRow>
          </CalmeDialog>
        </div>,
        document.body
      )}

    </div>
  );
}
