FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PYTHONPATH=/app

WORKDIR /app

RUN groupadd --system --gid 10001 note \
    && useradd --system --uid 10001 --gid note \
       --home-dir /app --shell /usr/sbin/nologin note \
    && mkdir -p /app/storage/documents \
       /app/storage/archives \
       /app/storage/extracted \
       /app/storage/thumbnails \
       /app/storage/temp \
    && chown -R note:note /app

COPY requirements.txt /app/requirements.txt

RUN pip install --no-cache-dir -r requirements.txt

COPY --chown=note:note app /app/app

USER note

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "1"]
