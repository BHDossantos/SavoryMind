FROM python:3.12-slim

WORKDIR /app

ENV PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential libpq-dev curl && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install -r requirements.txt

COPY app ./app

EXPOSE 8001
# Honour Cloud Run's $PORT when set, fall back to 8001 locally.
CMD exec uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8001}
