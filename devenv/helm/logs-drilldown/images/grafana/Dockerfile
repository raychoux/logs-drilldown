ARG GRAFANA_IMAGE=grafana/grafana
ARG GRAFANA_VERSION=13.1.3
FROM ${GRAFANA_IMAGE}:${GRAFANA_VERSION}

USER root
COPY dist/ /var/lib/grafana/plugins/grafana-lokiexplore-app/
RUN chown -R 472:0 /var/lib/grafana/plugins && \
    sed -i 's|</body>|<script src="http://localhost:35729/livereload.js"></script></body>|g' /usr/share/grafana/public/views/index.html
USER 472
