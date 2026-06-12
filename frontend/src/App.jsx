import { useState, useCallback, useRef, useEffect } from 'react';
import {
  ReactFlow, addEdge, MiniMap, Controls, Background,
  useNodesState, useEdgesState, MarkerType,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { v4 as uuidv4 } from 'uuid';
import CustomNode, { nodeConfig } from './CustomNode';
import './App.css';

const nodeTypes = { custom: CustomNode };
const API = 'http://localhost:5000';

const paletteItems = [
  { type: 'frontend', name: 'Frontend App', desc: 'Client application',  icon: '🖥️' },
  { type: 'gateway',  name: 'API Gateway',  desc: 'Request router',      icon: '🌐' },
  { type: 'service',  name: 'Service',      desc: 'Microservice / worker', icon: '🔧' },
  { type: 'database', name: 'Database',     desc: 'Data storage layer',  icon: '🗄️' },
  { type: 'cache',    name: 'Cache',        desc: 'In-memory store',     icon: '💾' },
  { type: 'queue',    name: 'Message Queue', desc: 'Async messaging',    icon: '📨' },
  { type: 'cdn',      name: 'CDN',          desc: 'Content delivery',    icon: '🌍' },
];

/* ---- helpers ---- */
function mapNode(n) {
  return { id: n.id, type: 'custom', position: n.position, data: { ...n.data } };
}
function mapEdge(e) {
  return {
    id: e.id, source: e.source, target: e.target, animated: true,
    label: e.data?.label || '', labelStyle: { fill: '#9ca3af', fontSize: 10 },
    labelBgStyle: { fill: '#12131a', fillOpacity: 0.85 },
    style: { stroke: 'rgba(124,92,252,0.45)', strokeWidth: 2 },
    markerEnd: { type: MarkerType.ArrowClosed, color: 'rgba(124,92,252,0.7)', width: 16, height: 16 },
    data: e.data,
  };
}

/* ---- Auto-layout (simple layered BFS) ---- */
function autoLayout(nodes, edges) {
  if (!nodes.length) return nodes;
  const incoming = {};
  const adj = {};
  nodes.forEach(n => { incoming[n.id] = new Set(); adj[n.id] = []; });
  edges.forEach(e => { if (incoming[e.target]) incoming[e.target].add(e.source); if (adj[e.source]) adj[e.source].push(e.target); });
  const layers = {};
  const visited = new Set();
  const roots = nodes.filter(n => incoming[n.id].size === 0).map(n => n.id);
  if (!roots.length) roots.push(nodes[0].id);
  const queue = roots.map(id => ({ id, layer: 0 }));
  while (queue.length) {
    const { id, layer } = queue.shift();
    if (visited.has(id)) continue;
    visited.add(id);
    layers[id] = layer;
    (adj[id] || []).forEach(t => { if (!visited.has(t)) queue.push({ id: t, layer: layer + 1 }); });
  }
  nodes.forEach(n => { if (layers[n.id] === undefined) layers[n.id] = 0; });
  const byLayer = {};
  nodes.forEach(n => { const l = layers[n.id]; if (!byLayer[l]) byLayer[l] = []; byLayer[l].push(n.id); });
  const XG = 300, YG = 180;
  return nodes.map(n => {
    const l = layers[n.id];
    const idx = byLayer[l].indexOf(n.id);
    const count = byLayer[l].length;
    return { ...n, position: { x: 100 + l * XG, y: 100 + idx * YG - ((count - 1) * YG) / 2 + 200 } };
  });
}

/* ============================================
   APP
   ============================================ */
function App() {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [selectedNode, setSelectedNode] = useState(null);
  const [loading, setLoading] = useState(true);
  const [connected, setConnected] = useState(false);
  const [liveMode, setLiveMode] = useState(true);
  const [toasts, setToasts] = useState([]);
  const [sysMetrics, setSysMetrics] = useState(null);
  const [editLabel, setEditLabel] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const rfInstance = useRef(null);
  const fileInputRef = useRef(null);

  /* -- toast -- */
  const toast = useCallback((msg, type = 'success') => {
    const id = uuidv4();
    setToasts(t => [...t, { id, msg, type }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 3500);
  }, []);

  /* -- fetch full graph -- */
  const fetchGraph = useCallback(async () => {
    try {
      const r = await fetch(`${API}/api/graph`);
      const d = await r.json();
      setNodes((d.nodes || []).map(mapNode));
      setEdges((d.edges || []).map(mapEdge));
      setConnected(true);
      return true;
    } catch {
      setConnected(false);
      return false;
    }
  }, [setNodes, setEdges]);

  /* -- initial load -- */
  useEffect(() => {
    fetchGraph().then(ok => {
      setLoading(false);
      toast(ok ? 'Connected — architecture loaded' : 'Backend offline — start the server', ok ? 'success' : 'error');
    });
  }, [fetchGraph, toast]);

  /* -- real-time polling -- */
  useEffect(() => {
    if (!liveMode || !connected) return;
    const interval = setInterval(async () => {
      try {
        const r = await fetch(`${API}/api/metrics`);
        const d = await r.json();
        setSysMetrics(d.system);
        setNodes(prev => prev.map(n => {
          const m = d.nodes[n.id];
          return m ? { ...n, data: { ...n.data, metrics: m } } : n;
        }));
      } catch { /* silent */ }
    }, 3000);
    return () => clearInterval(interval);
  }, [liveMode, connected, setNodes]);

  /* -- connection -- */
  const onConnect = useCallback(async (params) => {
    try {
      const r = await fetch(`${API}/api/edges`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source: params.source, target: params.target, protocol: 'HTTP', label: '' }),
      });
      const edge = await r.json();
      setEdges(eds => addEdge(mapEdge(edge), eds));
      toast('Connection created');
    } catch { toast('Failed to create connection', 'error'); }
  }, [setEdges, toast]);

  /* -- select / deselect -- */
  const onNodeClick = useCallback((_, node) => {
    setSelectedNode(node);
    setEditLabel(node.data?.label || '');
    setEditDesc(node.data?.description || '');
  }, []);
  const onPaneClick = useCallback(() => setSelectedNode(null), []);

  /* -- drag & drop from palette -- */
  const onDragOver = useCallback(e => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; }, []);
  const onDrop = useCallback(async (e) => {
    e.preventDefault();
    const type = e.dataTransfer.getData('application/reactflow-type');
    const name = e.dataTransfer.getData('application/reactflow-name');
    if (!type || !rfInstance.current) return;
    const position = rfInstance.current.screenToFlowPosition({ x: e.clientX, y: e.clientY });
    try {
      const r = await fetch(`${API}/api/nodes`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ label: name || type, nodeType: type, position, description: '' }),
      });
      const node = await r.json();
      setNodes(nds => [...nds, mapNode(node)]);
      toast(`Added ${name || type}`);
    } catch { toast('Failed to add node', 'error'); }
  }, [setNodes, toast]);

  /* -- toolbar actions -- */
  const handleFitView = () => rfInstance.current?.fitView({ padding: 0.25, duration: 500 });

  const handleAutoLayout = () => {
    setNodes(prev => autoLayout(prev, edges));
    setTimeout(() => rfInstance.current?.fitView({ padding: 0.25, duration: 500 }), 50);
    toast('Auto-layout applied');
  };

  const handleReset = async () => {
    try {
      const r = await fetch(`${API}/api/graph/reset`, { method: 'POST' });
      const d = await r.json();
      setNodes((d.nodes || []).map(mapNode));
      setEdges((d.edges || []).map(mapEdge));
      setSelectedNode(null);
      toast('Reset to default architecture');
      setTimeout(() => rfInstance.current?.fitView({ padding: 0.25, duration: 500 }), 50);
    } catch { toast('Reset failed', 'error'); }
  };

  const handleExport = () => {
    const data = {
      nodes: nodes.map(n => ({ id: n.id, position: n.position, data: { label: n.data.label, nodeType: n.data.nodeType, description: n.data.description || '' } })),
      edges: edges.map(e => ({ id: e.id, source: e.source, target: e.target, data: e.data || {} })),
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `dataflow-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
    toast('Graph exported');
  };

  const handleImport = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      const r = await fetch(`${API}/api/graph/import`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const d = await r.json();
      setNodes((d.nodes || []).map(mapNode));
      setEdges((d.edges || []).map(mapEdge));
      setSelectedNode(null);
      toast('Graph imported successfully');
      setTimeout(() => rfInstance.current?.fitView({ padding: 0.25, duration: 500 }), 50);
    } catch { toast('Invalid file format', 'error'); }
    e.target.value = '';
  };

  const handleDeleteNode = async (id) => {
    try {
      await fetch(`${API}/api/nodes/${id}`, { method: 'DELETE' });
      setNodes(nds => nds.filter(n => n.id !== id));
      setEdges(eds => eds.filter(e => e.source !== id && e.target !== id));
      if (selectedNode?.id === id) setSelectedNode(null);
      toast('Node deleted');
    } catch { toast('Delete failed', 'error'); }
  };

  const handleUpdateNode = async () => {
    if (!selectedNode) return;
    try {
      await fetch(`${API}/api/nodes/${selectedNode.id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ label: editLabel, description: editDesc }),
      });
      setNodes(nds => nds.map(n => n.id === selectedNode.id ? { ...n, data: { ...n.data, label: editLabel, description: editDesc } } : n));
      setSelectedNode(prev => prev ? { ...prev, data: { ...prev.data, label: editLabel, description: editDesc } } : null);
      toast('Node updated');
    } catch { toast('Update failed', 'error'); }
  };

  // Sync positions back to backend on drag end
  const onNodeDragStop = useCallback(async (_, node) => {
    try {
      await fetch(`${API}/api/nodes/${node.id}/position`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ position: node.position }),
      });
    } catch { /* silent */ }
  }, []);

  /* -- palette drag start -- */
  const onDragStart = (e, type, name) => {
    e.dataTransfer.setData('application/reactflow-type', type);
    e.dataTransfer.setData('application/reactflow-name', name);
    e.dataTransfer.effectAllowed = 'move';
  };

  /* -- minimap color -- */
  const mmColor = (n) => {
    const colors = { database:'#f472b6', api:'#7c5cfc', frontend:'#38bdf8', service:'#34d399',
      cache:'#fbbf24', gateway:'#a78bfa', queue:'#fb923c', cdn:'#2dd4bf' };
    return colors[n.data?.nodeType] || '#7c5cfc';
  };

  const sm = sysMetrics || {};

  return (
    <>
      {/* HEADER */}
      <header className="app-header">
        <div className="header-left">
          <div className="logo-icon">🔀</div>
          <span className="logo-text">DataFlow Visualizer</span>
        </div>
        <div className="header-center">
          <button className="header-btn" onClick={handleFitView} title="Zoom to fit all nodes">📐 Fit View</button>
          <button className="header-btn" onClick={handleAutoLayout} title="Auto-arrange nodes">🔄 Auto Layout</button>
          <button className="header-btn" onClick={handleReset} title="Reset to default graph">♻️ Reset</button>
          <div className="header-sep" />
          <button className="header-btn" onClick={handleExport} title="Download graph as JSON">📥 Export</button>
          <button className="header-btn" onClick={() => fileInputRef.current?.click()} title="Import graph from JSON">📤 Import</button>
          <input ref={fileInputRef} type="file" accept=".json" onChange={handleImport} style={{ display: 'none' }} />
          <div className="header-sep" />
          <button className={`header-btn ${liveMode ? 'active' : ''}`} onClick={() => setLiveMode(p => !p)} title={liveMode ? 'Pause real-time updates' : 'Resume real-time updates'}>
            {liveMode ? '⏸️ Live' : '▶️ Paused'}
          </button>
          {selectedNode && (
            <button className="header-btn danger" onClick={() => handleDeleteNode(selectedNode.id)} title="Delete selected node">🗑️ Delete</button>
          )}
        </div>
        <div className="header-right">
          <div className={`status-badge ${connected ? 'connected' : 'disconnected'}`}>
            <span className="status-dot" />{connected ? 'Connected' : 'Offline'}
          </div>
        </div>
      </header>

      {/* MAIN */}
      <div className="app-main">
        {/* SIDEBAR */}
        <aside className="sidebar">
          <div className="sidebar-section">
            <div className="sidebar-title">Node Palette</div>
            <p className="sidebar-hint">Drag nodes onto the canvas</p>
            <div className="node-palette">
              {paletteItems.map(item => (
                <div key={item.type} className="palette-item" draggable onDragStart={e => onDragStart(e, item.type, item.name)}>
                  <div className="palette-icon">{item.icon}</div>
                  <div className="palette-info">
                    <span className="palette-name">{item.name}</span>
                    <span className="palette-desc">{item.desc}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="sidebar-section">
            <div className="sidebar-title">Graph Statistics</div>
            <div className="stats-grid">
              <div className="stat-card"><div className="stat-value">{nodes.length}</div><div className="stat-label">Nodes</div></div>
              <div className="stat-card"><div className="stat-value">{edges.length}</div><div className="stat-label">Edges</div></div>
              <div className="stat-card"><div className="stat-value">{sm.healthyNodes ?? '—'}</div><div className="stat-label">Healthy</div></div>
              <div className="stat-card warn"><div className="stat-value">{(sm.warningNodes || 0) + (sm.errorNodes || 0) || '0'}</div><div className="stat-label">Alerts</div></div>
            </div>
          </div>

          <div className="sidebar-section">
            <div className="sidebar-title">System Metrics {liveMode && <span className="live-dot" />}</div>
            <div className="metrics-list">
              <div className="metric-row"><span>Avg Latency</span><span className="metric-val-side">{sm.avgLatency ?? '—'} ms</span></div>
              <div className="metric-row"><span>Throughput</span><span className="metric-val-side">{sm.totalThroughput ? (sm.totalThroughput / 1000).toFixed(1) + 'k/s' : '—'}</span></div>
              <div className="metric-row"><span>Avg CPU</span><span className="metric-val-side">{sm.avgCpu ?? '—'}%</span></div>
              <div className="metric-row"><span>Error Rate</span><span className="metric-val-side">{sm.avgErrorRate ?? '—'}%</span></div>
            </div>
          </div>
        </aside>

        {/* CANVAS */}
        <div className="canvas-wrapper">
          <div className="grid-bg" />
          {loading && <div className="loading-overlay"><div className="loading-spinner" /><span className="loading-text">Connecting to backend…</span></div>}

          <ReactFlow
            nodes={nodes} edges={edges}
            onNodesChange={onNodesChange} onEdgesChange={onEdgesChange}
            onConnect={onConnect} onNodeClick={onNodeClick} onPaneClick={onPaneClick}
            onDragOver={onDragOver} onDrop={onDrop} onNodeDragStop={onNodeDragStop}
            onInit={inst => { rfInstance.current = inst; setTimeout(() => inst.fitView({ padding: 0.25, duration: 600 }), 150); }}
            nodeTypes={nodeTypes} fitView snapToGrid snapGrid={[16, 16]}
            deleteKeyCode="Delete" proOptions={{ hideAttribution: true }}
          >
            <Background color="rgba(124,92,252,0.06)" gap={24} size={1} />
            <Controls position="bottom-right" />
            <MiniMap nodeColor={mmColor} maskColor="rgba(10,11,16,0.7)" style={{ background: '#12131a' }} />
          </ReactFlow>
        </div>

        {/* DETAILS PANEL */}
        {selectedNode && (
          <div className="details-panel">
            <div className="details-header">
              <span className="details-title">Node Inspector</span>
              <button className="details-close" onClick={() => setSelectedNode(null)}>✕</button>
            </div>

            <div className="details-section">
              <div className="details-section-title">Properties</div>
              <label className="detail-label">Name</label>
              <input className="detail-input" value={editLabel} onChange={e => setEditLabel(e.target.value)} />
              <label className="detail-label">Description</label>
              <textarea className="detail-textarea" value={editDesc} onChange={e => setEditDesc(e.target.value)} rows={3} />
              <button className="detail-save-btn" onClick={handleUpdateNode}>Save Changes</button>
            </div>

            <div className="details-section">
              <div className="details-section-title">Info</div>
              <div className="details-field"><span className="details-key">Type</span><span className="details-value">{selectedNode.data?.nodeType}</span></div>
              <div className="details-field"><span className="details-key">ID</span><span className="details-value" style={{ fontSize: 9 }}>{selectedNode.id}</span></div>
              <div className="details-field"><span className="details-key">Position</span><span className="details-value">{Math.round(selectedNode.position?.x || 0)}, {Math.round(selectedNode.position?.y || 0)}</span></div>
            </div>

            {selectedNode.data?.metrics && (
              <div className="details-section">
                <div className="details-section-title">Live Metrics</div>
                {Object.entries(selectedNode.data.metrics).filter(([k]) => k !== 'status').map(([k, v]) => (
                  <div className="details-field" key={k}>
                    <span className="details-key">{k}</span>
                    <span className="details-value">{typeof v === 'number' ? v.toFixed(1) : v}</span>
                  </div>
                ))}
                <div className="details-field">
                  <span className="details-key">Status</span>
                  <span className={`details-tag ${selectedNode.data.metrics.status}`}>{selectedNode.data.metrics.status}</span>
                </div>
              </div>
            )}

            <div className="details-section">
              <div className="details-section-title">Connections</div>
              <div className="details-field"><span className="details-key">Incoming</span><span className="details-value">{edges.filter(e => e.target === selectedNode.id).length}</span></div>
              <div className="details-field"><span className="details-key">Outgoing</span><span className="details-value">{edges.filter(e => e.source === selectedNode.id).length}</span></div>
            </div>

            <button className="detail-delete-btn" onClick={() => handleDeleteNode(selectedNode.id)}>🗑️ Delete Node</button>
          </div>
        )}
      </div>

      {/* TOASTS */}
      <div className="toast-container">
        {toasts.map(t => (
          <div key={t.id} className={`toast ${t.type}`}>{t.type === 'success' ? '✅' : '⚠️'} {t.msg}</div>
        ))}
      </div>
    </>
  );
}

export default App;
