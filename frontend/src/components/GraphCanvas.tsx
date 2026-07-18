import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  ReactFlow, 
  Background, 
  Controls, 
  useNodesState, 
  useEdgesState, 
  addEdge,
  ReactFlowProvider,
  useReactFlow
} from '@xyflow/react';
import type { Connection, Edge, Node } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { CustomNode } from './CustomNode';
import type { CustomNodeData } from './CustomNode';
import type { GraphNode, GraphEdge } from '../types';
import { api } from '../api';
import { Plus, Sparkles, MessageSquare, Trash2, Edit3, X, Check } from 'lucide-react';

// カスタムノードの登録
const nodeTypes = {
  customNode: CustomNode,
};

interface GraphCanvasProps {
  folderId: string;
  folderName: string;
  onOpenAIPanel: () => void;
  // 外部からの更新通知用
  refreshTrigger: number;
}

// ReactFlowProvider の中で動作させるためのインナーコンポーネント
const GraphCanvasInner: React.FC<GraphCanvasProps> = ({ 
  folderId, 
  folderName,
  onOpenAIPanel,
  refreshTrigger 
}) => {
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  
  // モーダル用状態
  const [isNodeModalOpen, setIsNodeModalOpen] = useState(false);
  const [nodeModalMode, setNodeModalMode] = useState<'create' | 'edit'>('create');
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [nodeText, setNodeText] = useState('');
  const [clickPosition, setClickPosition] = useState({ x: 100, y: 100 });

  // エッジラベル編集・削除用状態
  const [selectedEdge, setSelectedEdge] = useState<Edge | null>(null);
  const [isEdgeModalOpen, setIsEdgeModalOpen] = useState(false);
  const [edgeLabel, setEdgeLabel] = useState('');

  const { screenToFlowPosition } = useReactFlow();

  // 1. データ取得
  const loadGraphData = useCallback(async () => {
    try {
      const data = await api.getGraph(folderId);
      
      // Node 形式に変換
      const flowNodes: Node[] = data.nodes.map(n => ({
        id: n.id,
        type: 'customNode',
        position: { x: n.position_x, y: n.position_y },
        data: {
          text: n.text,
          onEdit: (id: string, currentText: string) => {
            setSelectedNodeId(id);
            setNodeText(currentText);
            setNodeModalMode('edit');
            setIsNodeModalOpen(true);
          },
          onDelete: async (id: string) => {
            if (confirm('このノードを削除しますか？\n関連するエッジもすべて削除されます。')) {
              await api.deleteNode(id);
              setNodes(nds => nds.filter(node => node.id !== id));
              setEdges(eds => eds.filter(edge => edge.source !== id && edge.target !== id));
            }
          }
        } as CustomNodeData
      }));

      // Edge 形式に変換
      const flowEdges: Edge[] = data.edges.map(e => ({
        id: e.id,
        source: e.source_id,
        target: e.target_id,
        label: e.label || undefined,
        animated: true,
        type: 'default',
        style: { stroke: 'var(--text-muted)' }
      }));

      setNodes(flowNodes);
      setEdges(flowEdges);
    } catch (err) {
      console.error('Failed to load graph data:', err);
    }
  }, [folderId, setNodes, setEdges]);

  useEffect(() => {
    loadGraphData();
  }, [loadGraphData, refreshTrigger]);

  // 2. ドラッグ終了時のオートセーブ
  const onNodeDragStop = useCallback(async (_event: React.MouseEvent, node: Node) => {
    try {
      await api.updateNode(node.id, {
        position_x: node.position.x,
        position_y: node.position.y
      });
      console.log(`Node ${node.id} position auto-saved.`);
    } catch (err) {
      console.error('Failed to auto-save node position:', err);
    }
  }, []);

  // 3. 手動でのエッジ（関係性）接続
  const onConnect = useCallback(async (connection: Connection) => {
    if (!connection.source || !connection.target) return;
    
    // 自己接続防止
    if (connection.source === connection.target) return;

    // ラベル入力のプロンプト
    const labelInput = prompt('この関係性の説明（ラベル）を入力してください（任意）:\n例: 「原因と結果」「対立する概念」');
    if (labelInput === null) return; // キャンセルされた場合

    try {
      const newEdgeData = await api.createEdge(
        folderId,
        connection.source,
        connection.target,
        labelInput.trim() || null
      );

      const newEdge: Edge = {
        id: newEdgeData.id,
        source: connection.source,
        target: connection.target,
        label: newEdgeData.label || undefined,
        animated: true,
        type: 'default',
        style: { stroke: 'var(--text-muted)' }
      };

      setEdges(eds => addEdge(newEdge, eds));
    } catch (err) {
      console.error('Failed to create edge:', err);
    }
  }, [folderId, setEdges]);

  // 4. ダブルクリックでノード追加ダイアログを開く
  const onPaneDoubleClick = useCallback((event: React.MouseEvent) => {
    // ターゲットがキャンバス（pane）である場合のみ処理する
    const target = event.target as Element;
    if (!target.classList.contains('react-flow__pane')) return;

    event.preventDefault();
    const position = screenToFlowPosition({
      x: event.clientX,
      y: event.clientY,
    });
    setClickPosition(position);
    setNodeText('');
    setNodeModalMode('create');
    setIsNodeModalOpen(true);
  }, [screenToFlowPosition]);

  // ノード作成・編集のサブミット
  const handleNodeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nodeText.trim()) return;

    try {
      if (nodeModalMode === 'create') {
        // 新規作成
        const newNodeData = await api.createNode(
          folderId,
          nodeText.trim(),
          clickPosition.x,
          clickPosition.y
        );

        const newNode: Node = {
          id: newNodeData.id,
          type: 'customNode',
          position: { x: newNodeData.position_x, y: newNodeData.position_y },
          data: {
            text: newNodeData.text,
            onEdit: (id: string, currentText: string) => {
              setSelectedNodeId(id);
              setNodeText(currentText);
              setNodeModalMode('edit');
              setIsNodeModalOpen(true);
            },
            onDelete: async (id: string) => {
              if (confirm('このノードを削除しますか？\n関連するエッジもすべて削除されます。')) {
                await api.deleteNode(id);
                setNodes(nds => nds.filter(n => n.id !== id));
                setEdges(eds => eds.filter(edge => edge.source !== id && edge.target !== id));
              }
            }
          } as CustomNodeData
        };

        setNodes(nds => nds.concat(newNode));
      } else if (nodeModalMode === 'edit' && selectedNodeId) {
        // 編集
        await api.updateNode(selectedNodeId, { text: nodeText.trim() });
        setNodes(nds => nds.map(n => {
          if (n.id === selectedNodeId) {
            return {
              ...n,
              data: {
                ...n.data,
                text: nodeText.trim()
              }
            };
          }
          return n;
        }));
      }
      setIsNodeModalOpen(false);
      setNodeText('');
      setSelectedNodeId(null);
    } catch (err) {
      console.error('Failed to submit node:', err);
    }
  };

  // 5. エッジクリック時の詳細編集・削除モーダル
  const onEdgeClick = useCallback((_event: React.MouseEvent, edge: Edge) => {
    setSelectedEdge(edge);
    setEdgeLabel(edge.label as string || '');
    setIsEdgeModalOpen(true);
  }, []);

  const handleUpdateEdge = async () => {
    if (!selectedEdge) return;
    try {
      const updated = await api.updateEdge(selectedEdge.id, edgeLabel.trim() || null);
      setEdges(eds => eds.map(e => {
        if (e.id === selectedEdge.id) {
          return {
            ...e,
            label: updated.label || undefined
          };
        }
        return e;
      }));
      setIsEdgeModalOpen(false);
    } catch (err) {
      console.error('Failed to update edge:', err);
    }
  };

  const handleDeleteEdge = async () => {
    if (!selectedEdge) return;
    if (confirm('この関係性（エッジ）を削除しますか？')) {
      try {
        await api.deleteEdge(selectedEdge.id);
        setEdges(eds => eds.filter(e => e.id !== selectedEdge.id));
        setIsEdgeModalOpen(false);
      } catch (err) {
        console.error('Failed to delete edge:', err);
      }
    }
  };

  // クイック追加ボタン用
  const handleQuickAddNode = () => {
    setClickPosition({ x: 200, y: 200 });
    setNodeText('');
    setNodeModalMode('create');
    setIsNodeModalOpen(true);
  };

  return (
    <div className="main-content">
      {/* ツールバー */}
      <div className="toolbar-floating">
        <div className="toolbar-group">
          <div className="toolbar-info">
            <span className="toolbar-folder-name">{folderName}</span>
            <span className="toolbar-folder-desc">
              {nodes.length} ノード / {edges.length} エッジ (ダブルクリックでノード追加)
            </span>
          </div>
        </div>

        <div className="toolbar-group">
          <button className="btn-secondary" onClick={handleQuickAddNode}>
            <Plus size={16} />
            <span>ノード追加</span>
          </button>
          <button className="btn-primary" onClick={onOpenAIPanel}>
            <Sparkles size={16} />
            <span>関係性を探す (AI)</span>
          </button>
        </div>
      </div>

      {/* キャンバス */}
      <div className="flow-container">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onNodeDragStop={onNodeDragStop}
          onConnect={onConnect}
          onDoubleClick={onPaneDoubleClick}
          onEdgeClick={onEdgeClick}
          nodeTypes={nodeTypes}
          fitView
          deleteKeyCode={null} // デフォルトのDeleteキーによるノード一括削除を防ぐ（確認ダイアログ付きにしたいため）
        >
          <Background color="rgba(255, 255, 255, 0.08)" gap={16} size={1} />
          <Controls />
        </ReactFlow>
      </div>

      {/* ノード追加・編集モーダル */}
      {isNodeModalOpen && (
        <div className="modal-overlay" onClick={() => setIsNodeModalOpen(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              {nodeModalMode === 'create' ? <Plus size={20} /> : <Edit3 size={20} />}
              <span>{nodeModalMode === 'create' ? '新規ノードの追加' : 'ノードの編集'}</span>
            </div>
            <form onSubmit={handleNodeSubmit}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">テキスト内容（引用、場面など）</label>
                  <textarea
                    className="form-textarea"
                    placeholder="ここにテキストを入力します..."
                    value={nodeText}
                    onChange={e => setNodeText(e.target.value)}
                    required
                    autoFocus
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button 
                  type="button" 
                  className="btn-secondary"
                  onClick={() => setIsNodeModalOpen(false)}
                >
                  キャンセル
                </button>
                <button type="submit" className="btn-primary">
                  {nodeModalMode === 'create' ? '追加する' : '更新する'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* エッジ詳細・編集モーダル */}
      {isEdgeModalOpen && selectedEdge && (
        <div className="modal-overlay" onClick={() => setIsEdgeModalOpen(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <MessageSquare size={20} />
              <span>関係性の編集</span>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label className="form-label">関係性のラベル</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="例: 対立、原因と結果、類似 など"
                  value={edgeLabel}
                  onChange={e => setEdgeLabel(e.target.value)}
                  autoFocus
                />
              </div>
            </div>
            <div className="modal-footer" style={{ justifyContent: 'space-between' }}>
              <button 
                type="button" 
                className="btn-secondary"
                style={{ color: 'var(--color-danger)', borderColor: 'rgba(239, 68, 68, 0.2)' }}
                onClick={handleDeleteEdge}
              >
                <Trash2 size={16} style={{ marginRight: '6px', display: 'inline' }} />
                関係性を削除
              </button>
              <div style={{ display: 'flex', gap: '12px' }}>
                <button 
                  type="button" 
                  className="btn-secondary"
                  onClick={() => setIsEdgeModalOpen(false)}
                >
                  キャンセル
                </button>
                <button 
                  type="button" 
                  className="btn-primary"
                  onClick={handleUpdateEdge}
                >
                  保存する
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ReactFlowProviderでラップしたコンポーネントをエクスポートする
export const GraphCanvas: React.FC<GraphCanvasProps> = (props) => (
  <ReactFlowProvider>
    <GraphCanvasInner {...props} />
  </ReactFlowProvider>
);
