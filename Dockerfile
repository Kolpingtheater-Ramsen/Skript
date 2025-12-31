FROM python:3.12-slim

WORKDIR /app

# Install git for git pull feature
RUN apt-get update && apt-get install -y --no-install-recommends git && \
    rm -rf /var/lib/apt/lists/*

# Copy requirements first for caching
COPY requirements.txt pyproject.toml ./

# Install dependencies using pip (from pyproject.toml deps)
RUN pip install --no-cache-dir \
    flask==3.1.2 \
    flask-socketio==5.5.1 \
    python-dotenv==1.2.1 \
    eventlet==0.40.3 \
    python-engineio==4.12.3 \
    python-socketio==5.15.1 \
    edge-tts>=7.2.7 \
    gevent-websocket==0.10.1 \
    pandas>=2.3.3 \
    requests>=2.32.5

# Copy app code
COPY . .

# Expose port
EXPOSE 5000

# Run the app
CMD ["python", "app.py"]
