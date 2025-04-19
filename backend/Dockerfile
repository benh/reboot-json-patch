FROM ghcr.io/reboot-dev/reboot-base:0.25.1

# Install Yarn
RUN corepack enable && \
    corepack prepare yarn@4.5.1 --activate

WORKDIR /app

# Copy the Reboot nodejs packages.
COPY package.json package.json
COPY tsconfig.json tsconfig.json

# Install the Reboot nodejs packages.
RUN npm install

# Next, copy the API definition and generate Reboot code. This step is
# separate so it is only repeated if the `api/` code changes.
COPY api/ api/
COPY .rbtrc .rbtrc

# Run the Reboot code generators. We did copy all of `api/`, possibly
# including generated code, but it's not certain that `rbt protoc` was run in
# that folder before this build was started.
RUN yarn rbt protoc

# Now copy the rest of the source code.
COPY backend/src/ backend/src/

RUN yarn tsc

ENTRYPOINT ["yarn", "rbt", "serve", "run"]