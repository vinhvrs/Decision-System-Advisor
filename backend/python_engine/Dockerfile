FROM python:3.12-slim

WORKDIR /app

# Cài đặt công cụ build hệ thống cho các thư viện tài chính/NLP
RUN apt-get update && apt-get install -y \
    build-essential \
    libffi-dev \
    libssl-dev \
    libxml2-dev \
    libxslt1-dev \
    zlib1g-dev \
    && rm -rf /var/lib/apt/lists/*

ENV PIP_DEFAULT_TIMEOUT=1000

# Copy requirements trước
COPY requirements.txt .

# Lượt 1: Nâng cấp pip & cài Torch CPU (Bản nặng nhất)
RUN pip install --no-cache-dir --upgrade pip setuptools wheel
RUN pip install --no-cache-dir torch --index-url https://download.pytorch.org/whl/cpu

# Lượt 2: Cài các thư viện Core Data (Ưu tiên bản binary cho ARM64)
RUN pip install --no-cache-dir --prefer-binary numpy pandas scipy

# Lượt 3: Cài toàn bộ các thư viện còn lại (Yfinance, Newspaper3k, v.v.)
RUN pip install --no-cache-dir --prefer-binary -r requirements.txt

# Copy source code
COPY . .

CMD ["python", "-m", "app.main"]
