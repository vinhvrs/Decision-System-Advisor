# Dockerfile.embedding
FROM python:3.12-slim

WORKDIR /app
RUN apt-get update && apt-get install -y \
    build-essential \
    libffi-dev \
    libssl-dev \
    libxml2-dev \
    libxslt1-dev \
    zlib1g-dev \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .

RUN pip install --no-cache-dir --upgrade pip setuptools wheel
RUN pip install --no-cache-dir torch --index-url https://download.pytorch.org/whl/cpu

RUN pip install --no-cache-dir --prefer-binary numpy pandas scipy

RUN pip install --no-cache-dir --prefer-binary -r requirements.txt

COPY . .

CMD ["python", "-m", "app.main"]