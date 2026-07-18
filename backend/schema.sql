-- 1. folders テーブルの作成
CREATE TABLE IF NOT EXISTS folders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    parent_id UUID REFERENCES folders(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. nodes テーブルの作成
CREATE TABLE IF NOT EXISTS nodes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    folder_id UUID REFERENCES folders(id) ON DELETE CASCADE NOT NULL,
    text TEXT NOT NULL,
    position_x DOUBLE PRECISION NOT NULL DEFAULT 0,
    position_y DOUBLE PRECISION NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. edges テーブルの作成
CREATE TABLE IF NOT EXISTS edges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    folder_id UUID REFERENCES folders(id) ON DELETE CASCADE NOT NULL,
    source_id UUID REFERENCES nodes(id) ON DELETE CASCADE NOT NULL,
    target_id UUID REFERENCES nodes(id) ON DELETE CASCADE NOT NULL,
    label TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. RLS (Row Level Security) の有効化
ALTER TABLE folders ENABLE ROW LEVEL SECURITY;
ALTER TABLE nodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE edges ENABLE ROW LEVEL SECURITY;

-- 5. RLS ポリシーの作成
-- 各ユーザーが自分のデータのみを操作できるようにします。

-- folders ポリシー
CREATE POLICY "Users can manage their own folders" ON folders
    FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- nodes ポリシー
CREATE POLICY "Users can manage their own nodes" ON nodes
    FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- edges ポリシー
CREATE POLICY "Users can manage their own edges" ON edges
    FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

