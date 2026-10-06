FROM node:22-bookworm-slim
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates curl p7zip-full && rm -rf /var/lib/apt/lists/*
COPY index.html style.css app.js xiangqi.js pikafish.cjs server.cjs ./
COPY Copying.txt NNUE-License.md SOURCE.md AUTHORS ./engine/
RUN curl --fail --location --retry 3 https://github.com/official-pikafish/Pikafish/releases/download/Pikafish-2026-09-06/Pikafish.2026-09-06.7z -o /tmp/pikafish.7z \
    && 7z e /tmp/pikafish.7z -o/app/engine Pikafish-Linux-x86-64-universal pikafish.nnue \
    && chmod 755 /app/engine/Pikafish-Linux-x86-64-universal \
    && rm /tmp/pikafish.7z
USER node
ENV XIANGQI_HOST=0.0.0.0 PORT=8765
EXPOSE 8765
CMD ["node", "server.cjs"]
