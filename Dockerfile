# syntax=docker/dockerfile:1

# Build the Nuxt frontend. Contract deployment is intentionally NOT part of
# this image. Deploy/export the desired network before building the image.
FROM node:22-alpine AS build

WORKDIR /src/frontend

COPY frontend/package*.json ./
RUN npm ci

COPY frontend ./

# The app currently imports app/contracts/addresses.localhost.json statically.
# To build an image for Sepolia, first run the Sepolia export and then build with:
#   docker build --build-arg CONTRACT_NETWORK=sepolia -t blch-voting-dapp:sepolia .
ARG CONTRACT_NETWORK=localhost
RUN if [ -f "app/contracts/addresses.${CONTRACT_NETWORK}.json" ]; then \
      cp "app/contracts/addresses.${CONTRACT_NETWORK}.json" app/contracts/addresses.localhost.json; \
    else \
      echo "Missing app/contracts/addresses.${CONTRACT_NETWORK}.json"; \
      echo "Run the deployment/export step for ${CONTRACT_NETWORK} before building the image."; \
      find app/contracts -maxdepth 1 -type f -print || true; \
      exit 1; \
    fi

RUN npm run build

# Runtime image: contains only the Nuxt build output and the entrypoint.
FROM node:22-alpine AS runtime

WORKDIR /app

ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=3000

COPY --from=build /src/frontend/.output ./.output
COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh

RUN chmod +x /usr/local/bin/docker-entrypoint.sh

EXPOSE 3000

ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["node", ".output/server/index.mjs"]
