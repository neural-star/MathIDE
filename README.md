# MathIDE

MathIDE is a React + TypeScript + Vite notebook interface backed by a FastAPI server.

## Docker Support

This project includes a `Dockerfile` configured for `linux/arm64` compatibility, making it suitable for Okdo Rock 4C+.

Build the Docker image:

```bash
npm run docker:build
```

Run the image locally:

```bash
npm run docker:run
```

Open `http://localhost:8000` in your browser.

## GitHub Actions CI

A CI workflow is available at `.github/workflows/ci.yml`.

It runs on `push` and `pull_request` to:

- install frontend dependencies
- build the frontend
- run Vitest tests
- build the ARM64 Docker image
- start the container and perform a smoke test

## Local development

Install dependencies:

```bash
npm ci
```

Run the frontend dev server:

```bash
npm run dev
```

Run the backend locally:

```bash
npm start
```

## Notes

- `app.py` serves built frontend assets from `dist/` when available.
- The Dockerfile performs a multi-stage build: Node for frontend build, Python for runtime.
