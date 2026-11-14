import dagre from 'dagre';

const nodeWidth = 350;
const nodeHeight = 140;

export function getLayoutedElements(nodes, edges, direction = 'LR') {
  const isHorizontal = direction === 'LR';

  const layoutGraph = new dagre.graphlib.Graph();
  layoutGraph.setDefaultEdgeLabel(() => ({}));
  layoutGraph.setGraph({
    rankdir: direction,
    ranksep: 120,   // horizontal gap between columns (LR)
    nodesep: 60,    // vertical gap between nodes in the same column
    edgesep: 20,
    marginx: 40,
    marginy: 40,
  });

  nodes.forEach((node) => {
    layoutGraph.setNode(node.id, { width: nodeWidth, height: nodeHeight });
  });

  edges.forEach((edge) => {
    layoutGraph.setEdge(edge.source, edge.target);
  });

  dagre.layout(layoutGraph);

  const layoutedNodes = nodes.map((node) => {
    const { x, y } = layoutGraph.node(node.id);
    return {
      ...node,
      position: { x, y },
      sourcePosition: isHorizontal ? 'right' : 'bottom',
      targetPosition: isHorizontal ? 'left' : 'top',
    };
  });

  return { nodes: layoutedNodes, edges };
}
