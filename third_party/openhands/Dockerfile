FROM python:3.12-slim

WORKDIR /app

COPY third_party/openhands/requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r /app/requirements.txt
COPY third_party/openhands/install_sdk.sh /app/install_sdk.sh
RUN bash /app/install_sdk.sh

COPY third_party/openhands/app.py /app/app.py

ENV PYTHONUNBUFFERED=1
EXPOSE 8000

CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8000"]
