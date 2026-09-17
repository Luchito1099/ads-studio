# syntax=docker/dockerfile:1

# ---------- build ----------
FROM node:24-bookworm-slim AS build
WORKDIR /app

# better-sqlite3 normalmente usa binarios precompilados; estas herramientas
# son el plan B si no hay prebuild para la arquitectura del host.
RUN apt-get update && apt-get install -y --no-install-recommends \
      python3 make g++ \
    && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm ci

# Falla acá, con mensaje claro, en vez de reventar al arrancar el contenedor
# si el binario nativo de SQLite no se compiló.
RUN node -e "require('better-sqlite3'); console.log('better-sqlite3 OK')"

COPY . .
RUN npm run build

# Se queda solo con las dependencias de producción para copiarlas al runtime.
RUN npm prune --omit=dev

# ---------- runtime ----------
FROM node:24-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ENV DB_PATH=/data/nova.db

COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/server ./server
COPY --from=build /app/extension ./extension

# SQLite (o el archivo a importar a Postgres) vive en el volumen persistente;
# el usuario `node` debe poder escribir.
RUN mkdir -p /data && chown -R node:node /data /app
USER node

VOLUME ["/data"]
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server/index.js"]
