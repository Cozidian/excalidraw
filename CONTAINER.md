# Run Excalidraw from a container

This repository packages the upstream Excalidraw app with its existing Dockerfile. It serves HTTP on port 80 and includes the `/up` endpoint Once requires for proxy health checks. GitHub Actions publishes an image to GHCR when code is pushed to `master` or `release` and when a `v*` tag is pushed. Branch builds use the `latest` tag; version tags keep their version.

The workflow publishes under the GitHub repository that receives the push. In a fork, push to its `release` branch or push a version tag to build the package. Set the package visibility to public in GitHub Packages to pull without authenticating; for a private package, authenticate Docker with a GitHub token that can read packages.

Set the image to the package published for your GitHub repository, then pull and run it with Docker Compose:

```sh
export EXCALIDRAW_IMAGE=ghcr.io/OWNER/REPOSITORY:latest
docker compose -f compose.ghcr.yml pull
docker compose -f compose.ghcr.yml up -d
```

Then open <http://localhost:3000>. To use a different port, set `EXCALIDRAW_PORT`, for example `EXCALIDRAW_PORT=8080 docker compose -f compose.ghcr.yml up -d`.

Excalidraw stores drawings in the browser's local storage, not in the container's `/storage` volume. Once's container backups therefore do not include drawings; export important drawings from Excalidraw to keep a portable backup.
