import os
import traceback
from typing import List, Optional
import jwt
from fastapi import FastAPI, HTTPException, status, Depends, Security, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel, Field
from dotenv import load_dotenv
from supabase import create_client, Client
from google import genai
from google.genai import types
from pathlib import Path
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

env_path = Path(__file__).parent / ".env"
load_dotenv(dotenv_path=env_path)

# レート制限の設定（接続元IPアドレスベース）
limiter = Limiter(key_func=get_remote_address)

app = FastAPI(title="Node Network Graph API")
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# エラーハンドラ
@app.exception_handler(Exception)
def global_exception_handler(request, exc):
    print("!!! EXCEPTION OCCURRED !!!")
    traceback.print_exc()  
    return JSONResponse(
        status_code=500,
        content={
            "message": "Internal Server Error",
            "detail": "An unexpected error occurred on the server."
        }
    )

# CORS設定

allow_origins = [
    "https://node-graph-ebon.vercel.app",
    "http://localhost:5173",
    "http://127.0.0.1:5173",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allow_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")
SUPABASE_JWT_SECRET = os.getenv("SUPABASE_JWT_SECRET")

if not SUPABASE_URL or not SUPABASE_KEY:
    print("WARNING: SUPABASE_URL or SUPABASE_KEY is not set.")
if not SUPABASE_JWT_SECRET:
    print("WARNING: SUPABASE_JWT_SECRET is not set. Token verification will fail.")

# supabaseの接続クライアント
def get_supabase() -> Client:
    if not SUPABASE_URL or not SUPABASE_KEY:
        raise HTTPException(
            status_code=500,
            detail="Supabase configuration is missing in environment variables."
        )
    return create_client(SUPABASE_URL, SUPABASE_KEY)

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

# gemini apiの接続クライアント
def get_gemini_client() -> genai.Client:
    if not GEMINI_API_KEY:
        raise HTTPException(
            status_code=500,
            detail="GEMINI_API_KEY is not set in environment variables."
        )
    return genai.Client(api_key=GEMINI_API_KEY)

# --- 認証（JWT検証）用設定 ---
security = HTTPBearer()

# JWKS (JSON Web Key Set) クライアントの初期化 (RS256/ES256検証用)
jwks_client = None
if SUPABASE_URL:
    jwks_url = f"{SUPABASE_URL.rstrip('/')}/auth/v1/.well-known/jwks.json"
    jwks_client = jwt.PyJWKClient(jwks_url)

def get_current_user(credentials: HTTPAuthorizationCredentials = Security(security)) -> str:
    token = credentials.credentials
    try:
        # トークンからアルゴリズムを自動検出（HS256, RS256, ES256等）
        unverified_header = jwt.get_unverified_header(token)
        alg = unverified_header.get("alg", "HS256").upper()
        print(f"DEBUG: JWT Header alg = {alg}")
        
        # アルゴリズムが非対称鍵（RSxxx, ESxxx等）の場合は JWKS を使用する
        if alg.startswith("RS") or alg.startswith("ES"):
            # RS256 / ES256 の場合は Supabase が公開している公開鍵を取得して検証
            if not jwks_client:
                raise HTTPException(
                    status_code=500,
                    detail="JWKS client is not initialized because SUPABASE_URL is missing."
                )
            print(f"DEBUG: Fetching signing key from JWKS for {alg}...")
            signing_key = jwks_client.get_signing_key_from_jwt(token)
            print(f"DEBUG: Decoding asymmetric token with alg {alg}...")
            payload = jwt.decode(
                token,
                signing_key.key,
                algorithms=["RS256", "ES256"],
                audience="authenticated"
            )
        else:
            # HS256 など対称鍵の場合は、ローカルの JWT_SECRET を使用
            print(f"DEBUG: Decoding symmetric token with alg {alg}...")
            if not SUPABASE_JWT_SECRET:
                raise HTTPException(
                    status_code=500,
                    detail="SUPABASE_JWT_SECRET is not set in backend environment variables."
                )
            payload = jwt.decode(
                token,
                SUPABASE_JWT_SECRET,
                algorithms=["HS256"],
                audience="authenticated"
            )
            
        user_id = payload.get("sub")
        if not user_id:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token: 'sub' claim is missing."
            )
        return user_id
    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token has expired."
        )
    except Exception as e:
        print("!!! JWT VERIFICATION ERROR !!!")
        traceback.print_exc()  # エラーが起きた正確な場所をコンソールに出力します
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid token: {str(e)}"
        )

# ---データの型決め---

class FolderCreate(BaseModel):
    name: str
    parent_id: Optional[str] = None

class FolderUpdate(BaseModel):
    name: Optional[str] = None
    parent_id: Optional[str] = None

class NodeCreate(BaseModel):
    text: str
    position_x: float = 0.0
    position_y: float = 0.0

class NodeUpdate(BaseModel):
    text: Optional[str] = None
    position_x: Optional[float] = None
    position_y: Optional[float] = None

class EdgeCreate(BaseModel):
    source_id: str
    target_id: str
    label: Optional[str] = None

class EdgeUpdate(BaseModel):
    label: Optional[str] = None

# Gemini関係性提案用スキーマ
class EdgeSuggestion(BaseModel):
    source_id: str = Field(description="接続元ノードのID")
    target_id: str = Field(description="接続先ノードのID")
    label: str = Field(description="二つのノードの関連性を示す短いラベル（日本語）")

class SuggestionResponse(BaseModel):
    suggestions: List[EdgeSuggestion] = Field(description="提案されたエッジ（関係性）のリスト")


# --api エンドポイント--

@app.get("/")
def read_root():
    return {"message": "Node Network Graph API is running"}


# -- 1. フォルダ関連 --

# フォルダ一覧取得
@app.get("/api/folders")
def get_folders(current_user_id: str = Depends(get_current_user)):
    db = get_supabase()
    try:
        response = db.table("folders").select("*").eq("user_id", current_user_id).execute()
        return response.data
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# フォルダ作成
@app.post("/api/folders", status_code=status.HTTP_201_CREATED)
def create_folder(folder: FolderCreate, current_user_id: str = Depends(get_current_user)):
    db = get_supabase()
    try:
        data = {
            "user_id": current_user_id,
            "name": folder.name,
            "parent_id": folder.parent_id if folder.parent_id else None
        }
        # 親フォルダがある場合、その所有権も確認する
        if folder.parent_id:
            parent_check = db.table("folders").select("id").eq("id", folder.parent_id).eq("user_id", current_user_id).execute()
            if not parent_check.data:
                raise HTTPException(status_code=403, detail="Access denied to parent folder")

        response = db.table("folders").insert(data).execute()
        if not response.data:
            raise HTTPException(status_code=400, detail="Failed to create folder")
        return response.data[0]                
    except HTTPException as he:
        raise he
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# フォルダ更新
@app.patch("/api/folders/{id}")
def update_folder(id: str, folder: FolderUpdate, current_user_id: str = Depends(get_current_user)):
    db = get_supabase()
    try:
        data = {}
        if folder.name is not None:
            data["name"] = folder.name
        if folder.parent_id is not None:
            data["parent_id"] = folder.parent_id if folder.parent_id else None
            # 親フォルダの所有権確認
            if folder.parent_id:
                parent_check = db.table("folders").select("id").eq("id", folder.parent_id).eq("user_id", current_user_id).execute()
                if not parent_check.data:
                    raise HTTPException(status_code=403, detail="Access denied to parent folder")
        
        response = db.table("folders").update(data).eq("id", id).eq("user_id", current_user_id).execute()
        if not response.data:
            raise HTTPException(status_code=404, detail="Folder not found or access denied")
        return response.data[0]
    except HTTPException as he:
        raise he
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# フォルダ削除
@app.delete("/api/folders/{id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_folder(id: str, current_user_id: str = Depends(get_current_user)):
    db = get_supabase()
    try:
        response = db.table("folders").delete().eq("id", id).eq("user_id", current_user_id).execute()
        return
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# -- 2. 特定フォルダ内のグラフデータ一括取得 --

@app.get("/api/folders/{folder_id}/graph")
def get_folder_graph(folder_id: str, current_user_id: str = Depends(get_current_user)):
    db = get_supabase()
    try:
        # フォルダの所有権を確認
        folder_check = db.table("folders").select("id").eq("id", folder_id).eq("user_id", current_user_id).execute()
        if not folder_check.data:
            raise HTTPException(status_code=403, detail="Access denied to this folder")

        # ノードの取得
        nodes_response = db.table("nodes").select("*").eq("folder_id", folder_id).eq("user_id", current_user_id).execute()
        # エッジの取得
        edges_response = db.table("edges").select("*").eq("folder_id", folder_id).eq("user_id", current_user_id).execute()
        
        return {
            "nodes": nodes_response.data,
            "edges": edges_response.data
        }
    except HTTPException as he:
        raise he
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# -- 3. ノード関連 --

# ノードの新規作成
@app.post("/api/folders/{folder_id}/nodes", status_code=status.HTTP_201_CREATED)
def create_node(folder_id: str, node: NodeCreate, current_user_id: str = Depends(get_current_user)):
    db = get_supabase()
    try:
        # フォルダの所有権を確認
        folder_check = db.table("folders").select("id").eq("id", folder_id).eq("user_id", current_user_id).execute()
        if not folder_check.data:
            raise HTTPException(status_code=403, detail="Access denied to this folder")

        data = {
            "user_id": current_user_id,
            "folder_id": folder_id,
            "text": node.text,
            "position_x": node.position_x,
            "position_y": node.position_y
        }
        response = db.table("nodes").insert(data).execute()
        if not response.data:
            raise HTTPException(status_code=400, detail="Failed to create node")
        return response.data[0]
    except HTTPException as he:
        raise he
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ノードのデータ変更
@app.patch("/api/nodes/{id}")
def update_node(id: str, node: NodeUpdate, current_user_id: str = Depends(get_current_user)):
    db = get_supabase()
    try:
        data = {}
        if node.text is not None:
            data["text"] = node.text
        if node.position_x is not None:
            data["position_x"] = node.position_x
        if node.position_y is not None:
            data["position_y"] = node.position_y

        response = db.table("nodes").update(data).eq("id", id).eq("user_id", current_user_id).execute()
        if not response.data:
            raise HTTPException(status_code=404, detail="Node not found or access denied")
        return response.data[0]
    except HTTPException as he:
        raise he
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ノードの削除
@app.delete("/api/nodes/{id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_node(id: str, current_user_id: str = Depends(get_current_user)):
    db = get_supabase()
    try:
        response = db.table("nodes").delete().eq("id", id).eq("user_id", current_user_id).execute()
        return
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# -- 4. エッジ関連 --

# エッジの作成
@app.post("/api/folders/{folder_id}/edges", status_code=status.HTTP_201_CREATED)
def create_edge(folder_id: str, edge: EdgeCreate, current_user_id: str = Depends(get_current_user)):
    db = get_supabase()
    try:
        # フォルダの所有権を確認
        folder_check = db.table("folders").select("id").eq("id", folder_id).eq("user_id", current_user_id).execute()
        if not folder_check.data:
            raise HTTPException(status_code=403, detail="Access denied to this folder")

        data = {
            "user_id": current_user_id,
            "folder_id": folder_id,
            "source_id": edge.source_id,
            "target_id": edge.target_id,
            "label": edge.label
        }
        response = db.table("edges").insert(data).execute()
        if not response.data:
            raise HTTPException(status_code=400, detail="Failed to create edge")
        return response.data[0]
    except HTTPException as he:
        raise he
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# エッジの更新
@app.patch("/api/edges/{id}")
def update_edge(id: str, edge: EdgeUpdate, current_user_id: str = Depends(get_current_user)):
    db = get_supabase()
    try:
        data = {}
        if edge.label is not None:
            data["label"] = edge.label

        response = db.table("edges").update(data).eq("id", id).eq("user_id", current_user_id).execute()
        if not response.data:
            raise HTTPException(status_code=404, detail="Edge not found or access denied")
        return response.data[0]
    except HTTPException as he:
        raise he
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# エッジの削除
@app.delete("/api/edges/{id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_edge(id: str, current_user_id: str = Depends(get_current_user)):
    db = get_supabase()
    try:
        response = db.table("edges").delete().eq("id", id).eq("user_id", current_user_id).execute()
        return
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# -- 5. AI（Gemini）連携による関係性示唆 --

# gemini 関連性提案機能
@app.post("/api/folders/{folder_id}/suggest-relations")
@limiter.limit("5/minute")
def suggest_relations(request: Request, folder_id: str, current_user_id: str = Depends(get_current_user)):
    db = get_supabase()
    ai_client = get_gemini_client()

    try:
        # フォルダの所有権を確認
        folder_check = db.table("folders").select("id").eq("id", folder_id).eq("user_id", current_user_id).execute()
        if not folder_check.data:
            raise HTTPException(status_code=403, detail="Access denied to this folder")

        # 1. フォルダ内のノードと既存のエッジを取得（ユーザーフィルタを追加）
        nodes_response = db.table("nodes").select("id, text").eq("folder_id", folder_id).eq("user_id", current_user_id).execute()
        edges_response = db.table("edges").select("source_id, target_id").eq("folder_id", folder_id).eq("user_id", current_user_id).execute()

        nodes = nodes_response.data
        existing_edges = edges_response.data

        if len(nodes) < 2:
            return {"suggestions": []}

        # 既存のエッジのペアをセットにする (無向グラフとして扱うためソートして保存)
        connected_pairs = set()
        for edge in existing_edges:
            pair = tuple(sorted([edge["source_id"], edge["target_id"]]))
            connected_pairs.add(pair)

        # 2. プロンプトの構築
        nodes_text_list = []
        for n in nodes:
            nodes_text_list.append(f"- ID: {n['id']}\n  テキスト: {n['text']}\n")
        nodes_prompt_block = "\n".join(nodes_text_list)

        prompt = f"""
あなたはテキスト間の「隠れた関係性」を見つけ出すアシスタントです。
以下は、あるフォルダに登録されているテキストノードのリストです。
これらのノードのうち、まだ関係性が定義されていない（接続されていない）ペアの中から、意味的・文脈的に関連性があり、並べて表示したり線を繋いだりすることで新たな気づきが得られそうなペアを見つけ出してください。

【ノードリスト】
{nodes_prompt_block}

【タスク】
1. テキストの内容を比較し、関連性の高いノードの組み合わせ（接続元IDと接続先ID）を提案してください。
2. 提案するペアに対して、どのような関係性があるかを説明する短いラベル（例: 「類似の構造」、「原因と結果」、「対立する概念」、「補足説明」など、10文字程度）を日本語で作成してください。
3. 既に接続されているペアや、関連性が薄いペアは提案しないでください。最大でも5個程度の提案に絞ってください。
"""

        # 3. Gemini APIの呼び出し（構造化JSON出力）
        response = ai_client.models.generate_content(
            model='gemini-3.5-flash',
            contents=prompt,
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                response_schema=SuggestionResponse,
            ),
        )

        # 構造化レスポンスのパース
        import json
        result = json.loads(response.text)

        # 提案されたエッジが既存のエッジと重複していないか、および有効なノードIDかチェックしてフィルタリング
        valid_node_ids = {n['id'] for n in nodes}
        filtered_suggestions = []
        
        for sug in result.get("suggestions", []):
            src = sug.get("source_id")
            tgt = sug.get("target_id")
            label = sug.get("label", "")

            # ノードIDが有効かつ同一ノードでなく、まだ繋がっていないペアのみ追加
            if src in valid_node_ids and tgt in valid_node_ids and src != tgt:
                pair = tuple(sorted([src, tgt]))
                if pair not in connected_pairs:
                    filtered_suggestions.append({
                        "source_id": src,
                        "target_id": tgt,
                        "label": label
                    })

        return {"suggestions": filtered_suggestions}

    except HTTPException as he:
        raise he
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
