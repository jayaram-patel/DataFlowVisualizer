import { memo } from 'react';
import { Handle, Position } from '@xyflow/react';

const nodeConfig = {
  database: { icon: '🗄️', className: 'node-database' },
  api:      { icon: '⚡', className: 'node-api' },
  frontend: { icon: '🖥️', className: 'node-frontend' },
  service:  { icon: '🔧', className: 'node-service' },
  cache:    { icon: '💾', className: 'node-cache' },
  gateway:  { icon: '🌐', className: 'node-gateway' },
  queue:    { icon: '📨', className: 'node-queue' },
  cdn:      { icon: '🌍', className: 'node-cdn' },
};

function fmtNum(n) {
  if (n >= 1000) return (n / 1000).toFixed(1) + 'k';
  return n?.toFixed?.(0) ?? '—';
}

const statusColors = {
  healthy: '#34d399',
  warning: '#fbbf24',
  error: '#ef4444',
  idle: '#6b7280',
};

function CustomNode({ data, selected }) {
  const nodeType = data.nodeType || 'service';
  const config = nodeConfig[nodeType] || nodeConfig.service;
  const m = data.metrics || {};
  const status = m.status || 'healthy';

  return (
    <div className={`custom-node ${config.className} ${selected ? 'selected' : ''}`}>
      <Handle type="target" position={Position.Left} />

      <div className="node-header">
        <div className="node-icon">{config.icon}</div>
        <span className="node-title">{data.label}</span>
        <span
          className="node-status-dot"
          style={{ background: statusColors[status] }}
          title={status}
        />
      </div>

      <div className="node-body">
        <div className="node-metrics-row">
          <div className="node-metric">
            <span className="metric-val">{m.latency != null ? m.latency + 'ms' : '—'}</span>
            <span className="metric-lbl">Latency</span>
          </div>
          <div className="node-metric">
            <span className="metric-val">{m.throughput != null ? fmtNum(m.throughput) + '/s' : '—'}</span>
            <span className="metric-lbl">Throughput</span>
          </div>
          <div className="node-metric">
            <span className="metric-val">{m.cpu != null ? m.cpu + '%' : '—'}</span>
            <span className="metric-lbl">CPU</span>
          </div>
        </div>
      </div>

      <div className="node-status-bar" style={{ background: statusColors[status] }} />

      <Handle type="source" position={Position.Right} />
    </div>
  );
}

export default memo(CustomNode);
export { nodeConfig };
