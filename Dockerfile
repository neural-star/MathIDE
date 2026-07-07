# Build frontend
FROM node:20-alpine AS build
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY tsconfig*.json vite.config.ts index.html ./
COPY public ./public
COPY src ./src
RUN npm run build

# Runtime image
FROM python:3.14-slim AS runtime
WORKDIR /app

COPY --from=build /app/dist ./dist
COPY app.py pyproject.toml ./
COPY python ./python

RUN pip install --no-cache-dir fastapi uvicorn numpy sympy requests

EXPOSE 8000
CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8000"]