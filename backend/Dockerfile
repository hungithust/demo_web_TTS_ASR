FROM python:3.12-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
EXPOSE 8000
# Persist the SQLite DB and generated audio across container recreations.
# The image ships with seed data; a fresh volume is initialised from it.
VOLUME ["/app/data", "/app/static/audio"]
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
