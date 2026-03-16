FROM python:3.11-slim

WORKDIR /app

ENV PIP_DEFAULT_TIMEOUT=1000
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV OPENBLAS_CORETYPE=ARMV8

RUN apt-get update && apt-get install -y \
    build-essential \
    libffi-dev \
    libssl-dev \
    libxml2-dev \
    libxslt1-dev \
    zlib1g-dev \
    libopenblas-dev \
    libblas-dev \
    liblapack-dev \
 && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .

RUN pip install --no-cache-dir --upgrade pip setuptools wheel

# 1) Cài torch trước, pin version rõ ràng
RUN pip install --no-cache-dir torch==2.4.1

# 2) Test ngay trong lúc build
RUN python -X faulthandler -c "import torch; print(torch.__version__)"

# 3) Cài phần còn lại nhưng bỏ torch ra để tránh pip đụng lại
RUN grep -vE '^(torch|sentence-transformers)\s*$' requirements.txt > /tmp/requirements-no-torch.txt && \
    pip install --no-cache-dir --prefer-binary numpy pandas scipy && \
    pip install --no-cache-dir --prefer-binary -r /tmp/requirements-no-torch.txt

# 4) Cuối cùng mới cài sentence-transformers
RUN pip install --no-cache-dir sentence-transformers==3.0.1

# 5) Test thêm lớp trên
RUN python -X faulthandler -c "from sentence_transformers import SentenceTransformer; print('sentence-transformers ok')"

COPY . .

CMD ["python", "-m", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
