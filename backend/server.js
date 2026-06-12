const express = require("express");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json({ limit: "5mb" }));

const PORT = 5000;

// --- ID Generator ---
let idCounter = 200;
function genId(prefix = "n") {
  return `${prefix}-${Date.now()}-${++idCounter}`;
}

// --- Metric Simulation ---
function simMetrics(nodeType, nodeId) {
  const t = Date.now() / 1000;
  const hash = (nodeId || "").split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  const phase = hash % 100;

  const bases = {
    frontend: { latency: 45, throughput: 850, cpu: 25, memory: 180, errorRate: 0.3 },
    cdn:      { latency: 8,  throughput: 2400, cpu: 15, memory: 120, errorRate: 0.1 },
    gateway:  { latency: 12, throughput: 1800, cpu: 35, memory: 256, errorRate: 0.5 },
    service:  { latency: 28, throughput: 1200, cpu: 40, memory: 320, errorRate: 0.8 },
    cache:    { latency: 2,  throughput: 5000, cpu: 20, memory: 512, errorRate: 0.05 },
    database: { latency: 15, throughput: 800,  cpu: 55, memory: 1024,errorRate: 0.2 },
    queue:    { latency: 5,  throughput: 3000, cpu: 18, memory: 256, errorRate: 0.1 },
  };
  const b = bases[nodeType] || bases.service;
  const v = (val, pct) => {
    const s = Math.sin((t + phase) / 5) * val * pct * 0.3;
    const n = (Math.random() - 0.5) * val * pct;
    return Math.max(0, +(val + s + n).toFixed(1));
  };
  const metrics = {
    latency: v(b.latency, 0.3),
    throughput: v(b.throughput, 0.15),
    cpu: Math.min(100, v(b.cpu, 0.2)),
    memory: v(b.memory, 0.1),
    errorRate: Math.min(100, Math.max(0, v(b.errorRate, 0.5))),
    uptime: +(99 + Math.random() * 0.99).toFixed(2),
  };
  if (metrics.errorRate > 5) metrics.status = "error";
  else if (metrics.errorRate > 2 || metrics.cpu > 80) metrics.status = "warning";
  else if (metrics.throughput < 10) metrics.status = "idle";
  else metrics.status = "healthy";
  return metrics;
}

// --- Default Graph Factory ---
function createDefaultGraph() {
  idCounter = 200;
  return {
    nodes: [
      { id: "client",        position: { x: 80,   y: 280 }, data: { label: "Client Browser",      nodeType: "frontend", description: "End-user web application served to browsers" }},
      { id: "cdn",            position: { x: 80,   y: 60 },  data: { label: "CDN / Static Assets",  nodeType: "cdn",      description: "Content delivery network for static files" }},
      { id: "gateway",        position: { x: 380,  y: 280 }, data: { label: "API Gateway",          nodeType: "gateway",  description: "Central entry point routing requests to microservices" }},
      { id: "auth-service",   position: { x: 680,  y: 60 },  data: { label: "Auth Service",         nodeType: "service",  description: "Handles authentication, JWT tokens, and OAuth flows" }},
      { id: "user-service",   position: { x: 680,  y: 280 }, data: { label: "User Service",         nodeType: "service",  description: "Manages user profiles, preferences, and accounts" }},
      { id: "order-service",  position: { x: 680,  y: 500 }, data: { label: "Order Service",        nodeType: "service",  description: "Processes orders, payments, and fulfillment logic" }},
      { id: "redis-cache",    position: { x: 980,  y: 120 }, data: { label: "Redis Cache",          nodeType: "cache",    description: "In-memory cache for sessions, tokens, and hot data" }},
      { id: "postgres-db",    position: { x: 980,  y: 350 }, data: { label: "PostgreSQL",           nodeType: "database", description: "Primary relational database for persistent storage" }},
      { id: "message-queue",  position: { x: 1280, y: 280 }, data: { label: "RabbitMQ",             nodeType: "queue",    description: "Message broker for async communication between services" }},
      { id: "notif-service",  position: { x: 1530, y: 120 }, data: { label: "Notification Service", nodeType: "service",  description: "Sends emails, SMS, and push notifications" }},
      { id: "analytics",      position: { x: 1530, y: 440 }, data: { label: "Analytics Engine",     nodeType: "service",  description: "Processes events for dashboards and business insights" }},
    ],
    edges: [
      { id: "e-1",  source: "client",       target: "cdn",           data: { protocol: "HTTP",  label: "Static files" }},
      { id: "e-2",  source: "client",       target: "gateway",       data: { protocol: "HTTPS", label: "API requests" }},
      { id: "e-3",  source: "gateway",      target: "auth-service",  data: { protocol: "gRPC",  label: "Auth check" }},
      { id: "e-4",  source: "gateway",      target: "user-service",  data: { protocol: "gRPC",  label: "User ops" }},
      { id: "e-5",  source: "gateway",      target: "order-service", data: { protocol: "gRPC",  label: "Order ops" }},
      { id: "e-6",  source: "auth-service",  target: "redis-cache",  data: { protocol: "TCP",   label: "Token cache" }},
      { id: "e-7",  source: "user-service",  target: "redis-cache",  data: { protocol: "TCP",   label: "Session cache" }},
      { id: "e-8",  source: "user-service",  target: "postgres-db",  data: { protocol: "TCP",   label: "User data" }},
      { id: "e-9",  source: "auth-service",  target: "postgres-db",  data: { protocol: "TCP",   label: "Auth data" }},
      { id: "e-10", source: "order-service", target: "postgres-db",  data: { protocol: "TCP",   label: "Order data" }},
      { id: "e-11", source: "order-service", target: "message-queue", data: { protocol: "AMQP", label: "Order events" }},
      { id: "e-12", source: "message-queue", target: "notif-service", data: { protocol: "AMQP", label: "Notifications" }},
      { id: "e-13", source: "message-queue", target: "analytics",     data: { protocol: "AMQP", label: "Event stream" }},
    ],
  };
}

let graph = createDefaultGraph();

// --- Attach live metrics to graph snapshot ---
function getGraphWithMetrics() {
  return {
    nodes: graph.nodes.map((n) => ({
      ...n,
      data: { ...n.data, metrics: simMetrics(n.data.nodeType, n.id) },
    })),
    edges: graph.edges,
  };
}

// ===================== ROUTES =====================

// Health
app.get("/", (req, res) => {
  res.json({ status: "ok", message: "DataFlow Visualizer API", nodes: graph.nodes.length, edges: graph.edges.length });
});

// Full graph (with live metrics)
app.get("/api/graph", (req, res) => {
  res.json(getGraphWithMetrics());
});

// Metrics only (lightweight for polling)
app.get("/api/metrics", (req, res) => {
  const metrics = {};
  graph.nodes.forEach((n) => { metrics[n.id] = simMetrics(n.data.nodeType, n.id); });
  // Aggregated system metrics
  const vals = Object.values(metrics);
  const avg = (arr, key) => +(arr.reduce((s, m) => s + m[key], 0) / arr.length).toFixed(1);
  res.json({
    nodes: metrics,
    system: {
      totalNodes: vals.length,
      totalEdges: graph.edges.length,
      avgLatency: avg(vals, "latency"),
      avgCpu: avg(vals, "cpu"),
      totalThroughput: Math.round(vals.reduce((s, m) => s + m.throughput, 0)),
      avgErrorRate: avg(vals, "errorRate"),
      healthyNodes: vals.filter((m) => m.status === "healthy").length,
      warningNodes: vals.filter((m) => m.status === "warning").length,
      errorNodes: vals.filter((m) => m.status === "error").length,
    },
  });
});

// --- Node CRUD ---
app.post("/api/nodes", (req, res) => {
  const { label, nodeType, position, description } = req.body;
  if (!label || !nodeType) return res.status(400).json({ error: "label and nodeType required" });
  const node = {
    id: genId("n"),
    position: position || { x: 400, y: 300 },
    data: { label, nodeType, description: description || "" },
  };
  graph.nodes.push(node);
  res.status(201).json(node);
});

app.put("/api/nodes/:id", (req, res) => {
  const node = graph.nodes.find((n) => n.id === req.params.id);
  if (!node) return res.status(404).json({ error: "Node not found" });
  const { label, description, nodeType } = req.body;
  if (label !== undefined) node.data.label = label;
  if (description !== undefined) node.data.description = description;
  if (nodeType !== undefined) node.data.nodeType = nodeType;
  res.json(node);
});

app.patch("/api/nodes/:id/position", (req, res) => {
  const node = graph.nodes.find((n) => n.id === req.params.id);
  if (!node) return res.status(404).json({ error: "Node not found" });
  if (req.body.position) node.position = req.body.position;
  res.json(node);
});

app.delete("/api/nodes/:id", (req, res) => {
  const idx = graph.nodes.findIndex((n) => n.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: "Node not found" });
  graph.nodes.splice(idx, 1);
  graph.edges = graph.edges.filter((e) => e.source !== req.params.id && e.target !== req.params.id);
  res.json({ success: true });
});

// --- Edge CRUD ---
app.post("/api/edges", (req, res) => {
  const { source, target, protocol, label } = req.body;
  if (!source || !target) return res.status(400).json({ error: "source and target required" });
  const edge = { id: genId("e"), source, target, data: { protocol: protocol || "HTTP", label: label || "" } };
  graph.edges.push(edge);
  res.status(201).json(edge);
});

app.delete("/api/edges/:id", (req, res) => {
  const idx = graph.edges.findIndex((e) => e.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: "Edge not found" });
  graph.edges.splice(idx, 1);
  res.json({ success: true });
});

// --- Graph operations ---
app.post("/api/graph/reset", (req, res) => {
  graph = createDefaultGraph();
  res.json(getGraphWithMetrics());
});

app.post("/api/graph/import", (req, res) => {
  const { nodes, edges } = req.body;
  if (!nodes || !edges) return res.status(400).json({ error: "nodes and edges arrays required" });
  graph = { nodes, edges };
  res.json(getGraphWithMetrics());
});

// --- Start ---
app.listen(PORT, () => {
  console.log(`DataFlow Visualizer API running on port ${PORT}`);
  console.log(`  → ${graph.nodes.length} nodes, ${graph.edges.length} edges loaded`);
});