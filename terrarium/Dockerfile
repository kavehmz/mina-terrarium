FROM docker.io/library/node:22-alpine
WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev --no-audit --no-fund && npm cache clean --force
COPY src ./src
COPY public ./public
COPY tools ./tools
ENV NODE_ENV=production PORT=3000
EXPOSE 3000
CMD ["node", "src/server.mjs"]
