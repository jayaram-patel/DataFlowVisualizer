# DataFlow Visualizer

An interactive dashboard for visualizing microservice architectures. Drag and drop nodes, draw connections, and watch live simulated metrics — all in one canvas.

![React](https://img.shields.io/badge/React-19-blue) ![Express](https://img.shields.io/badge/Express-5-green) ![Vite](https://img.shields.io/badge/Vite-8-purple)

## What it does

- **Canvas editor** — built on React Flow. You can add services (frontend, gateway, database, cache, queue, CDN, etc.), connect them with edges, drag things around, and it all syncs with the backend.
- **Live metrics** — the backend simulates realistic CPU, latency, throughput, memory, and error rates for each node. Metrics update every 3 seconds and the nodes show their health status in real time.
- **Node inspector** — click any node to see its details, edit its name/description, or check its live stats.
- **Import / Export** — save your architecture as JSON and load it back later.
- **Auto layout** — one-click BFS-based layout to clean up messy graphs.

## Tech stack

| Layer    | Tech                          |
|----------|-------------------------------|
| Frontend | React 19, React Flow, Vite    |
| Backend  | Express 5, Node.js            |
| Styling  | Custom CSS (dark theme)       |

## Getting started

You need Node.js installed. Then:

```bash
# start the backend
cd backend
npm install
npm start

# in another terminal, start the frontend
cd frontend
npm install
npm run dev
```

Backend runs on `http://localhost:5000`, frontend on `http://localhost:5173`.

## Project structure

```
├── backend/
│   └── server.js         # REST API + metric simulation
├── frontend/
│   └── src/
│       ├── App.jsx        # Main app with canvas, sidebar, toolbar
│       ├── CustomNode.jsx # Custom node component for React Flow
│       ├── App.css        # All the styling
│       └── main.jsx       # Entry point
```

## API overview

| Method   | Endpoint                    | What it does              |
|----------|-----------------------------|---------------------------|
| `GET`    | `/api/graph`                | Full graph with metrics   |
| `GET`    | `/api/metrics`              | Just the metrics (polling)|
| `POST`   | `/api/nodes`                | Add a node                |
| `PUT`    | `/api/nodes/:id`            | Update node label/desc    |
| `PATCH`  | `/api/nodes/:id/position`   | Update node position      |
| `DELETE` | `/api/nodes/:id`            | Remove a node             |
| `POST`   | `/api/edges`                | Add a connection          |
| `DELETE` | `/api/edges/:id`            | Remove a connection       |
| `POST`   | `/api/graph/reset`          | Reset to default graph    |
| `POST`   | `/api/graph/import`         | Import a full graph       |

## Notes

- Metrics are simulated — there's no actual infrastructure being monitored. The simulation uses sine waves + noise to make the numbers feel dynamic.
- State is in-memory, so restarting the backend resets everything to the default architecture.
- The default graph models a typical e-commerce backend: client → gateway → services → databases/queues → notification/analytics.

## License

MIT
