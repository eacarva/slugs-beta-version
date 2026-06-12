FROM oven/bun:canary AS build

WORKDIR /app
COPY ./package.json ./

RUN bun install
COPY . .
RUN mkdir -p maxmind

ENV PUBLIC_VERSION=beta-1.0.0
ENV SLUGS_DEBUG=true

RUN bun run build

FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=1000

COPY --from=build /app/build ./build
COPY --from=build /app/package.json ./
COPY --from=build /app/config ./config
COPY --from=build /app/maxmind ./maxmind
COPY --from=build /app/project.inlang ./project.inlang
COPY --from=build /app/messages ./messages
COPY --from=build /app/drizzle.config.ts ./drizzle.config.ts
COPY --from=build /app/src/lib/server/db ./src/lib/server/db
COPY --from=build /app/static ./static
COPY --from=build /app/scripts ./scripts

RUN npm install --omit=dev --legacy-peer-deps

ENV PUBLIC_VERSION=beta-1.0.0
ENV SLUGS_DEBUG=false
ENV PORT=1000
ENV SLUGS_ORIGIN=""

EXPOSE 1000

CMD ["node", "./scripts/start.mjs"]
