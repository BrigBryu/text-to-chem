# Release Checklist

Use this checklist for a simple GitHub Pages release.

## Before Push

- Choose the repository name.
- Set the Vite base path in `vite.config.js`.
  - Project page: `"/REPO_NAME/"`
  - Root/custom domain: `"/"`
- Run local verification:

```bash
npm run verify
```

## Publish

- Push the repository to GitHub.
- In GitHub repository settings, open `Pages`.
- Set `Build and deployment` source to `GitHub Actions`.
- Push to `main` and wait for the `Deploy to GitHub Pages` workflow.

## Verify

- Open `https://USERNAME.github.io/REPO_NAME/`.
- Import a molecule-card package.
- Confirm rendered cards show lone pairs, charges, captions, and arrows when present.
- Test SVG and PNG export buttons.
- Test at mobile width.
- Test browser install/PWA support if your browser exposes it.
- Reload once, then test basic offline load after the app has loaded online.

## Later

- Add a screenshot to `README.md`.
- Tag a release after the deployed app is verified.
