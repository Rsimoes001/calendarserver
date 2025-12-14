
FROM python:3.11-slim
WORKDIR /app
ENV PYTHONDONTWRITEBYTECODE=1         PYTHONUNBUFFERED=1

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app/ ./app/

ENV SECRET_KEY="change-me"
EXPOSE 5000
CMD ["python", "-c", "from app.server import app; from waitress import serve; serve(app, host='0.0.0.0', port=5000)"]
