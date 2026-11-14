# PySpark Parser Frontend — Agent Notes

## Project Overview
A React + Vite frontend that visualises PySpark data pipeline code as an interactive DAG graph. Users paste/upload JSON (nodes + edges) representing parsed PySpark transformations; the app renders them as a ReactFlow canvas with dagre auto-layout.

---

## Tech Stack
- **React 18** + **Vite**
- **ReactFlow** — interactive node/edge graph canvas
- **dagre** — auto-layout algorithm (left-to-right DAG)
- **react-icons/md** — Material Design icons
- **react-tooltip** — hover tooltips on nodes

---

## File Structure

```
src/
├── App.jsx                        # Root component: state, layout logic, ReactFlow canvas
├── App.css
├── main.jsx
├── index.css
├── components/
│   ├── CustomNode.jsx             # ReactFlow custom node renderer
│   ├── CustomToolbar.jsx          # Floating toolbar (zoom, upload JSON, download, variables)
│   ├── RightPanel.jsx             # Side panel shown on node click (metadata, code, lineage)
│   ├── GraphSidebar.jsx           # Left sidebar for saved graphs (upload modal) — currently unused in App.jsx
│   ├── GraphSidebar.css
│   └── AddModal.jsx               # Reusable modal wrapper
├── icons/
│   └── JoinIcon.jsx               # Custom SVG icon for join types
└── utils/
    └── getLayoutedElements.jsx    # Wraps dagre layout; returns positioned nodes + edges
```

---

## Data Flow

1. On load, `App.jsx` reads `graph_data` from `localStorage` (`initialNodes`, `initialEdges`).
2. `applyAutoLayout(nodes, edges)` runs:
   - `calculateDownstreamUsage` — enriches each node with `data.variable` and `data.downstreamCount`
   - `getLayoutedElements` — runs dagre LR layout, assigns `x/y` positions
   - `generateStyledEdges` — adds stroke colour, arrowheads, `smoothstep` type to edges
3. ReactFlow renders the positioned nodes (filtering out `type: 'variable'` nodes from the canvas).
4. Clicking a node opens **RightPanel** with collapsible metadata blocks and column lineage.
5. The toolbar's **Add** button accepts pasted JSON `{nodes, edges}`, calls `applyLayout` to re-layout and re-render.

---

## Node Shape

```json
{
  "id": "node_1",
  "type": "custom",
  "variable": "df_name",
  "position": { "x": 0, "y": 0 },
  "data": {
    "operation": ["join", "select"],
    "inputs": ["df_a", "df_b"],
    "code": "...",
    "metadata": [ { "type": "join", ... }, { "type": "select", ... } ],
    "columns": {
      "col_name": {
        "sources": [{ "prev_node": "node_0", "prev_col": "col_name" }],
        "type": "direct"
      }
    }
  }
}
```

Special node type `"variable"` is not rendered on the canvas but is accessible via the Variables toolbar button.

---

## Edge Shape

```json
{ "id": "e1", "source": "node_0", "target": "node_1" }
```

Edges are styled by `generateStyledEdges` (blue, smoothstep, arrowclosed).

---

## Key Functions (App.jsx)

| Function | Purpose |
|---|---|
| `applyAutoLayout(nodes?, edges?)` | Full pipeline: usage calc → dagre layout → styled edges → set state. Accepts optional args; defaults to module-level `initialNodes`/`initialEdges`. |
| `calculateDownstreamUsage` | Counts how many edges leave each node; copies `node.variable` → `node.data.variable`. |
| `generateStyledEdges` | Applies stroke/arrow styles to edges. |

---

## Known Bugs Fixed

1. **Dagre singleton** (`getLayoutedElements.jsx`): `layoutGraph` was a module-level instance — repeated calls accumulated stale nodes/edges. Fixed by creating a fresh instance per call.
2. **Toolbar upload bypass**: `CustomToolbar.handleModalSubmit` was calling `setNodes`/`setEdges` directly, skipping dagre layout, `calculateDownstreamUsage`, and `generateStyledEdges`. Fixed by calling `applyLayout(nodes, edges)` instead.
3. **`applyAutoLayout` closure**: was hardcoded to module-level `initialNodes`/`initialEdges`. Fixed by adding optional `nodes`/`edges` parameters.

---

## Saved Graphs (GraphSidebar)
`GraphSidebar.jsx` exists but is **not mounted in App.jsx**. It provides a resizable left sidebar listing saved graphs by name and an upload modal for pasting nodes/edges JSON.

---

## localStorage
- Key: `graph_data` — JSON string `{ nodes: [...], edges: [...] }`
- Read once at module load into `initialNodes`/`initialEdges`.
- Written when user uploads new data via toolbar.
