import React, { useState, useEffect } from 'react';
import type { EdgeSuggestion, Folder, GraphNode } from '../types';
import { api } from '../api';
import { Sparkles, Check, X, ArrowRight, Info } from 'lucide-react';

interface RelationSuggesterProps {
  folderId: string;
  onClose: () => void;
  onEdgeAdded: () => void; // エッジが追加されたことを親に通知
}

export const RelationSuggester: React.FC<RelationSuggesterProps> = ({
  folderId,
  onClose,
  onEdgeAdded
}) => {
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<EdgeSuggestion[]>([]);
  const [nodes, setNodes] = useState<Record<string, string>>({}); // id -> text のマップ
  const [error, setError] = useState<string | null>(null);

  // 1. ノード情報をロード（提案カードにノードのテキストを表示するため）
  useEffect(() => {
    const loadNodes = async () => {
      try {
        const data = await api.getGraph(folderId);
        const map: Record<string, string> = {};
        data.nodes.forEach(n => {
          map[n.id] = n.text;
        });
        setNodes(map);
      } catch (err) {
        console.error('Failed to load nodes for preview:', err);
      }
    };
    loadNodes();
  }, [folderId]);

  // 2. Gemini による提案の取得
  const fetchSuggestions = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.suggestRelations(folderId);
      setSuggestions(data.suggestions);
    } catch (err: any) {
      console.error(err);
      setError('AIの提案取得に失敗しました。GeminiのAPIキーや接続を確認してください。');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSuggestions();
  }, [folderId]);

  // 3. 承認処理
  const handleAccept = async (suggestion: EdgeSuggestion, index: number) => {
    try {
      // エッジの作成
      await api.createEdge(
        folderId,
        suggestion.source_id,
        suggestion.target_id,
        suggestion.label
      );
      
      // 一覧から削除
      setSuggestions(prev => prev.filter((_, i) => i !== index));
      // キャンバスの再描画をトリガー
      onEdgeAdded();
    } catch (err) {
      console.error('Failed to create edge from suggestion:', err);
      alert('関係性の作成に失敗しました。');
    }
  };

  // 4. 却下処理
  const handleReject = (index: number) => {
    setSuggestions(prev => prev.filter((_, i) => i !== index));
  };

  return (
    <div className="suggestion-panel">
      <div className="suggestion-header">
        <h2 className="suggestion-title">
          <Sparkles size={18} style={{ color: 'var(--color-secondary)' }} />
          <span>AIによる関係性の提案</span>
        </h2>
        <button className="folder-action-btn" onClick={onClose}>
          <X size={18} />
        </button>
      </div>

      <div className="suggestion-content">
        {loading ? (
          <div className="suggestion-loading">
            <div className="spinner"></div>
            <div>Gemini がテキストを分析中...</div>
          </div>
        ) : error ? (
          <div style={{ color: 'var(--color-danger)', fontSize: '13px', textAlign: 'center', padding: '20px' }}>
            {error}
            <button className="btn-secondary" style={{ marginTop: '12px', width: '100%' }} onClick={fetchSuggestions}>
              再試行する
            </button>
          </div>
        ) : suggestions.length === 0 ? (
          <div className="suggestion-empty">
            <Info size={32} style={{ color: 'var(--text-muted)' }} />
            <div>新しい関係性の提案はありません。</div>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
              ノードをもっと増やすか、別のテキストを追加すると、Gemini が新たな繋がりを見つけ出せるようになります。
            </p>
            <button className="btn-secondary" style={{ marginTop: '16px' }} onClick={fetchSuggestions}>
              再スキャンする
            </button>
          </div>
        ) : (
          <>
            <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '8px' }}>
              Gemini は以下の接続を提案しています。承認するとネットワーク図に反映されます。
            </p>
            {suggestions.map((sug, index) => (
              <div key={index} className="suggestion-card">
                <div className="suggestion-nodes-preview">
                  <div className="node-preview-item">
                    {nodes[sug.source_id] || '不明なノード'}
                  </div>
                  <div className="suggestion-arrow">
                    <ArrowRight size={14} style={{ marginRight: '6px' }} />
                    <span style={{ 
                      background: 'rgba(6, 182, 212, 0.15)', 
                      color: 'var(--color-secondary)',
                      padding: '2px 8px',
                      borderRadius: '12px',
                      fontWeight: 600,
                      fontSize: '11px'
                    }}>
                      {sug.label}
                    </span>
                  </div>
                  <div className="node-preview-item target">
                    {nodes[sug.target_id] || '不明なノード'}
                  </div>
                </div>

                <div className="suggestion-actions">
                  <button 
                    className="btn-action-reject" 
                    onClick={() => handleReject(index)}
                  >
                    <X size={12} style={{ display: 'inline', marginRight: '4px' }} />
                    却下
                  </button>
                  <button 
                    className="btn-action-accept" 
                    onClick={() => handleAccept(sug, index)}
                  >
                    <Check size={12} style={{ display: 'inline', marginRight: '4px' }} />
                    承認して接続
                  </button>
                </div>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
};
