FROM node:20-alpine

WORKDIR /app

COPY package.json pnpm-lock.yaml* package-lock.json* ./

RUN if [ -f pnpm-lock.yaml ]; then \
      corepack enable && pnpm install; \
    else \
      npm install; \
    fi

COPY . .

EXPOSE 5173

CMD ["npm", "run", "dev", "--", "--host"]

