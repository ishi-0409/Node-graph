export interface Folder {
  id: string;
  name: string;
  parent_id: string | null;
  created_at: string;
}

export interface GraphNode {
  id: string;
  folder_id: string;
  text: string;
  position_x: number;
  position_y: number;
  created_at: string;
}

export interface GraphEdge {
  id: string;
  folder_id: string;
  source_id: string;
  target_id: string;
  label: string | null;
  created_at: string;
}

export interface EdgeSuggestion {
  source_id: string;
  target_id: string;
  label: string;
}
