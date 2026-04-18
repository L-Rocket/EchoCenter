# Multi-version frontend image.
# Override FRONTEND_VERSION at build time to pick which UI to bake:
#   docker build --build-arg FRONTEND_VERSION=v3 -f frontend/Dockerfile .
# Default is v1 (the original React/Vite app).

ARG FRONTEND_VERSION=v1

FROM node:22-alpine AS builder
ARG FRONTEND_VERSION
ENV FRONTEND_VERSION=${FRONTEND_VERSION}

WORKDIR /src/frontend

COPY frontend/${FRONTEND_VERSION}/package.json frontend/${FRONTEND_VERSION}/package-lock.json ./
RUN npm ci

COPY frontend/${FRONTEND_VERSION} ./

RUN npm run build

FROM nginx:1.29-alpine

COPY docker/nginx/default.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /src/frontend/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
