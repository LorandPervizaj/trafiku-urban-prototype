# GitHub Pages deployment

The code repository is rooted at the local Part 3 directory, keeping Part 1 and Part 2 PDFs outside it. Only production files are packaged; all source edits and generated local artifacts remain under Part 3.

1. Push the repository to `LorandPervizaj/trafiku-urban-prototype`, branch `main`.
2. GitHub Settings > Pages > Build and deployment > Source: GitHub Actions.
3. Run/inspect the `Deploy Trafiku Urban to Pages` workflow in Actions.
4. The workflow runs deterministic tests, creates dist/, uploads the Pages artifact, and deploys it.
5. Confirm https://lorandpervizaj.github.io/trafiku-urban-prototype/ returns HTTP 200 and exercise Map, Plan and Ticket there. A successful commit alone is not deployment verification.

No secrets are needed. Workflow permissions are contents:read, pages:write, id-token:write. The built-in github-pages environment controls deployments. If deployment is denied, an owner may need to permit the main branch in that environment or enable Pages under repository settings. Never paste tokens into this repository.

To package locally run `python tests/package-site.py`. Serve dist/ over HTTP and use the same browser checks. Relative asset URLs support the GitHub Pages project prefix.

Rollback: use GitHub's revert action or revert a source commit and push; the workflow redeploys the prior app. Preferences live on each browser/origin, so localhost and github.io intentionally have separate saved journeys. The application does not cache its own shell with a service worker.

Live verification results and commit details are recorded in docs/testing.md after deployment.
