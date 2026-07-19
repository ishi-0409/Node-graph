# ベースイメージとして Python 3.11 の軽量版を使用
FROM python:3.11-slim

# 作業ディレクトリを /app に設定
WORKDIR /app

# 依存パッケージファイルをコピーしてインストール
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# ソースコード全体をコピー
COPY . .

# Cloud Run はデフォルトで PORT 環境変数（通常は 8080）を渡すため、それに合わせて uvicorn を起動
CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port ${PORT:-8080}"]
