# Dockerfile.embedding
FROM python:3.13-slim

WORKDIR /app
RUN apt-get update && apt-get install -y build-essential

COPY requirements.txt .
RUN pip install --no-cache-dir torch --index-url https://download.pytorch.org/whl/cpu 
RUN pip install --no-cache-dir sentence-transformers fastapi uvicorn pydantic-settings

COPY app/services/embedding/main.py .

CMD ["python", "main.py"]