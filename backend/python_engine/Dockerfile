FROM python:3.11-slim

WORKDIR /app

ENV PIP_DEFAULT_TIMEOUT=1000 \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

RUN apt-get update && apt-get install -y \
    build-essential \
    libffi-dev \
    libssl-dev \
    libxml2-dev \
    libxslt1-dev \
    zlib1g-dev \
    libgomp1 \
    libopenblas0 \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .

RUN pip install --no-cache-dir --upgrade pip setuptools wheel

# PyPI wheels work for both x86_64 Linux and ARM64 Linux (Apple Silicon Docker / Pi).
RUN pip install --no-cache-dir torch==2.4.1
RUN python -X faulthandler -c "import torch; print('torch', torch.__version__)"

RUN grep -vE '^(torch|sentence-transformers)([<=> ].*)?$' requirements.txt > /tmp/requirements-no-ml.txt \
    && pip install --no-cache-dir --prefer-binary -r /tmp/requirements-no-ml.txt

RUN pip install --no-cache-dir sentence-transformers==3.0.1
RUN python -X faulthandler -c "from sentence_transformers import SentenceTransformer; print('sentence-transformers ok')"

COPY . .

CMD ["python", "-m", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
