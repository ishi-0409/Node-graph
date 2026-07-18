import React from 'react';
import { Handle, Position } from '@xyflow/react';
import type { NodeProps } from '@xyflow/react';
import { Trash2, Edit } from 'lucide-react';

// custom node のデータ型
export interface CustomNodeData {
  text: string;
  onEdit: (id: string, currentText: string) => void;
  onDelete: (id: string) => void;
}

export const CustomNode: React.FC<NodeProps> = ({ id, data, selected }) => {
  const nodeData = data as unknown as CustomNodeData;

  return (
    <div className={`custom-node ${selected ? 'selected' : ''}`}>
      {/* ターゲットハンドル (入力) - 左側 */}
      <Handle
        type="target"
        position={Position.Left}
        id="target"
        className="custom-node-handle"
      />

      <div className="custom-node-text">{nodeData.text || 'テキストを入力...'}</div>

      {/* アクションボタン (ホバー時に表示) */}
      <div className="custom-node-actions" onClick={e => e.stopPropagation()}>
        <button
          className="folder-action-btn"
          title="編集"
          onClick={() => nodeData.onEdit(id, nodeData.text)}
        >
          <Edit size={12} />
        </button>
        <button
          className="folder-action-btn delete"
          title="削除"
          onClick={() => nodeData.onDelete(id)}
        >
          <Trash2 size={12} />
        </button>
      </div>

      {/* ソースハンドル (出力) - 右側 */}
      <Handle
        type="source"
        position={Position.Right}
        id="source"
        className="custom-node-handle"
      />
    </div>
  );
};
