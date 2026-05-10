# syntax=docker/dockerfile:1

# Build the Nuxt frontend. Contract deployment is intentionally NOT part of
# this image. Deploy/export the desired network before building the image.
FROM node:22-alpine AS build

WORKDIR /src/frontend

COPY frontend/package*.json ./
RUN npm ci

COPY frontend ./

# The frontend imports app/contracts/addresses.json. The export script writes
# that stable file for the selected network. Keep this check so CI fails early
# when the deployment/export step was skipped.
ARG CONTRACT_NETWORK=localhost
RUN if [ ! -f "app/contracts/addresses.json" ]; then \
      echo "Missing app/contracts/addresses.json"; \
      echo "Run: npm run export:frontend:<network> before building the image."; \
      find app/contracts -maxdepth 1 -type f -print || true; \
      exit 1; \
    fi && \
    echo "Building frontend with contract config:" && \
    cat app/contracts/addresses.json

RUN npm run build

# Runtime image: contains only the Nuxt build output and the entrypoint.
FROM node:22-alpine AS runtime

WORKDIR /app

ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=3000

COPY --from=build /src/frontend/.output ./.output
COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh

# Normalize CRLF line endings in case the file was edited on Windows/WSL.
RUN sed -i 's/\r$//' /usr/local/bin/docker-entrypoint.sh && \
    chmod +x /usr/local/bin/docker-entrypoint.sh

EXPOSE 3000

ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]
CMD ["node", ".output/server/index.mjs"]
