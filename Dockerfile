FROM node:22-alpine AS base

WORKDIR /app
COPY package.json .

# development stage
FROM base AS development

RUN npm install
COPY . .
EXPOSE 3000
CMD ["npm", "run", "start:dev"]

# testing stage
FROM base AS testing

RUN npm install
COPY . .
EXPOSE 4000
CMD ["npm", "run", "start:test"]

# production stage
FROM base AS production

RUN npm install --omit=dev
COPY . .
EXPOSE 5000
CMD ["npm", "run", "start"]