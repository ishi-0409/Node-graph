import type { Folder, GraphNode, GraphEdge, EdgeSuggestion } from './types';
import { supabase } from './supabase';

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8000/api';

// APIリクエスト時にSupabaseのJWTアクセストークンをヘッダーに自動付与するヘルパー
async function getAuthHeaders(additionalHeaders: Record<string, string> = {}): Promise<HeadersInit> {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;
  return {
    ...additionalHeaders,
    ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
  };
}

export const api = {
  // フォルダ
  async getFolders(): Promise<Folder[]> {
    const headers = await getAuthHeaders();
    const res = await fetch(`${API_BASE}/folders`, { headers });
    if (!res.ok) throw new Error('Failed to fetch folders');
    return res.json();
  },

  async createFolder(name: string, parentId: string | null): Promise<Folder> {
    const headers = await getAuthHeaders({ 'Content-Type': 'application/json' });
    const res = await fetch(`${API_BASE}/folders`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ name, parent_id: parentId }),
    });
    if (!res.ok) throw new Error('Failed to create folder');
    return res.json();
  },

  async updateFolder(id: string, name?: string, parentId?: string | null): Promise<Folder> {
    const headers = await getAuthHeaders({ 'Content-Type': 'application/json' });
    const res = await fetch(`${API_BASE}/folders/${id}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ name, parent_id: parentId }),
    });
    if (!res.ok) throw new Error('Failed to update folder');
    return res.json();
  },

  async deleteFolder(id: string): Promise<void> {
    const headers = await getAuthHeaders();
    const res = await fetch(`${API_BASE}/folders/${id}`, { 
      method: 'DELETE',
      headers 
    });
    if (!res.ok) throw new Error('Failed to delete folder');
  },

  // グラフ一括取得
  async getGraph(folderId: string): Promise<{ nodes: GraphNode[]; edges: GraphEdge[] }> {
    const headers = await getAuthHeaders();
    const res = await fetch(`${API_BASE}/folders/${folderId}/graph`, { headers });
    if (!res.ok) throw new Error('Failed to fetch graph data');
    return res.json();
  },

  // ノード
  async createNode(folderId: string, text: string, x: number, y: number): Promise<GraphNode> {
    const headers = await getAuthHeaders({ 'Content-Type': 'application/json' });
    const res = await fetch(`${API_BASE}/folders/${folderId}/nodes`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ text, position_x: x, position_y: y }),
    });
    if (!res.ok) throw new Error('Failed to create node');
    return res.json();
  },

  async updateNode(id: string, updates: { text?: string; position_x?: number; position_y?: number }): Promise<GraphNode> {
    const headers = await getAuthHeaders({ 'Content-Type': 'application/json' });
    const res = await fetch(`${API_BASE}/nodes/${id}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify(updates),
    });
    if (!res.ok) throw new Error('Failed to update node');
    return res.json();
  },

  async deleteNode(id: string): Promise<void> {
    const headers = await getAuthHeaders();
    const res = await fetch(`${API_BASE}/nodes/${id}`, { 
      method: 'DELETE',
      headers
    });
    if (!res.ok) throw new Error('Failed to delete node');
  },

  // エッジ
  async createEdge(folderId: string, sourceId: string, targetId: string, label: string | null): Promise<GraphEdge> {
    const headers = await getAuthHeaders({ 'Content-Type': 'application/json' });
    const res = await fetch(`${API_BASE}/folders/${folderId}/edges`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ source_id: sourceId, target_id: targetId, label }),
    });
    if (!res.ok) throw new Error('Failed to create edge');
    return res.json();
  },

  async updateEdge(id: string, label: string | null): Promise<GraphEdge> {
    const headers = await getAuthHeaders({ 'Content-Type': 'application/json' });
    const res = await fetch(`${API_BASE}/edges/${id}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ label }),
    });
    if (!res.ok) throw new Error('Failed to update edge');
    return res.json();
  },

  async deleteEdge(id: string): Promise<void> {
    const headers = await getAuthHeaders();
    const res = await fetch(`${API_BASE}/edges/${id}`, { 
      method: 'DELETE',
      headers
    });
    if (!res.ok) throw new Error('Failed to delete edge');
  },

  // Gemini関係性提案
  async suggestRelations(folderId: string): Promise<{ suggestions: EdgeSuggestion[] }> {
    const headers = await getAuthHeaders();
    const res = await fetch(`${API_BASE}/folders/${folderId}/suggest-relations`, {
      method: 'POST',
      headers,
    });
    if (!res.ok) throw new Error('Failed to suggest relations');
    return res.json();
  },
};
