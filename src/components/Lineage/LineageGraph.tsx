import React, { useMemo, useCallback } from 'react';
import ReactFlow, { 
  Background, 
  Controls, 
  MiniMap, 
  Node, 
  Edge,
  MarkerType,
  Handle,
  Position,
  useNodesState,
  useEdgesState
} from 'react-flow-renderer';
import { DiscoveredTable, DatabaseRelationship } from '../../types/database';
import { Database } from 'lucide-react';

const TableNode = ({ data, selected }: any) => {
  return (
    <div className={`bg-slate-900 border ${selected ? 'border-amber-500 shadow-[0_0_15px_rgba(245,158,11,0.3)]' : 'border-slate-700'} rounded-md min-w-[150px] shadow-lg`}>
      <div className="bg-slate-800/80 px-3 py-2 rounded-t-md flex items-center border-b border-slate-700">
        <Database className="w-3.5 h-3.5 mr-2 text-indigo-400" />
        <div className="text-xs font-semibold text-white">{data.label}</div>
      </div>
      <div className="p-2 text-[10px] text-slate-400">
        {data.rowCount?.toLocaleString()} rows
      </div>
      <Handle type="target" position={Position.Top} className="w-2 h-2 bg-slate-600 border-none" />
      <Handle type="source" position={Position.Bottom} className="w-2 h-2 bg-slate-600 border-none" />
    </div>
  );
};

const nodeTypes = {
  tableNode: TableNode
};

interface LineageGraphProps {
  tables: DiscoveredTable[];
  relationships: DatabaseRelationship[];
  selectedNode: string | null;
  onSelectNode: (nodeId: string | null) => void;
}

export const LineageGraph: React.FC<LineageGraphProps> = ({ tables, relationships, selectedNode, onSelectNode }) => {
  const { initialNodes, initialEdges } = useMemo(() => {
    const nodes: Node[] = [];
    const edges: Edge[] = [];
    
    // Grid layout calculation
    const cols = Math.ceil(Math.sqrt(tables.length));
    
    tables.forEach((t, i) => {
      const row = Math.floor(i / cols);
      const col = i % cols;
      
      nodes.push({
        id: `${t.schema}.${t.name}`,
        type: 'tableNode',
        position: { x: col * 250, y: row * 150 },
        data: { 
          label: t.name,
          schema: t.schema,
          rowCount: t.approximateRowCount
        }
      });
    });
    
    relationships.forEach((r, i) => {
      const sourceId = `${r.sourceSchema}.${r.sourceTable}`;
      const targetId = `${r.targetSchema}.${r.targetTable}`;
      
      edges.push({
        id: `e-${sourceId}-${targetId}-${i}`,
        source: sourceId,
        target: targetId,
        label: `${r.sourceColumn} → ${r.targetColumn}`,
        labelStyle: { fill: '#94a3b8', fontSize: 10, fontWeight: 500 },
        labelBgStyle: { fill: '#0f172a', stroke: '#1e293b' },
        animated: false,
        style: { stroke: '#475569', strokeWidth: 1.5 },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: '#475569',
        }
      });
    });
    
    return { initialNodes: nodes, initialEdges: edges };
  }, [tables, relationships]);

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  // Update selection state when selectedNode changes
  React.useEffect(() => {
    setNodes(nds => nds.map(n => ({
      ...n,
      selected: n.id === selectedNode
    })));
  }, [selectedNode, setNodes]);

  const onNodeClick = useCallback((event: React.MouseEvent, node: Node) => {
    onSelectNode(node.id);
  }, [onSelectNode]);

  const onPaneClick = useCallback(() => {
    onSelectNode(null);
  }, [onSelectNode]);

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      onNodeClick={onNodeClick}
      onPaneClick={onPaneClick}
      nodeTypes={nodeTypes}
      fitView
      className="bg-slate-950"
    >
      <Background color="#1e293b" gap={20} size={1} />
      <Controls className="bg-slate-900 border-slate-700 fill-slate-300" />
      <MiniMap 
        nodeColor={(n) => {
          if (n.selected) return '#f59e0b';
          return '#334155';
        }}
        maskColor="rgba(15, 23, 42, 0.7)"
        className="bg-slate-900 border border-slate-800"
      />
    </ReactFlow>
  );
};
