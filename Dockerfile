FROM node:22-alpine AS client-build

WORKDIR /app/client
COPY client/package.json client/package-lock.json* ./
RUN npm ci
COPY client/ .
RUN npm run build

FROM node:22-alpine AS server-build

WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci
COPY tsconfig.json .
COPY src/ src/
RUN npx tsc

FROM node:22-alpine

WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev

COPY --from=server-build /app/dist ./dist
COPY --from=client-build /app/client/dist ./client/dist

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

CMD ["node", "dist/main.js"]
