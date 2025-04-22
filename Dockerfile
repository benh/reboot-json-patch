FROM ghcr.io/reboot-dev/reboot-base:0.25.1

# Install Yarn
RUN corepack enable && \
    corepack prepare yarn@4.5.1 --activate

WORKDIR /app

# Copy only files necessary for installing packages.
COPY .yarnrc.yml .
COPY yarn.lock .
COPY package.json .
COPY api/package.json api/
COPY common/package.json common/
COPY backend/package.json backend/
COPY web/package.json web/

# Install packages.
RUN yarn install

# Run `rbt` so that we install remaining Reboot dependencies once
# not every time!
RUN yarn rbt --help

COPY . .

WORKDIR /app/backend

# Run the Reboot code generators (even though we might have copied
# generated code from api/ directory, we don't know if that generated code
# is up to date)
RUN yarn rbt protoc

# Transpile. This will produce a "bundle" at
# /app/node_modules/@reboot-dev/reboot/.bundles/docs/bundle.js
# that we explicitly pass as our application below.
RUN yarn rbt-esbuild src/main.ts docs

# NOTE: the rest of the `rbt serve run` arguments come from `.rbtrc`.
ENTRYPOINT ["yarn", "rbt", "serve", "run", "--application=/app/node_modules/@reboot-dev/reboot/.bundles/docs/bundle.js"]