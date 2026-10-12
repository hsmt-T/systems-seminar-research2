FROM node:24-bookworm-slim

ENV WRANGLER_SEND_METRICS=false

WORKDIR /app

RUN npm install --global pnpm@10.24.0 \
    && chown node:node /app

USER node

COPY --chown=node:node package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

COPY --chown=node:node . ./

EXPOSE 8787

CMD ["pnpm", "dev", "--ip", "0.0.0.0", "--port", "8787"]
