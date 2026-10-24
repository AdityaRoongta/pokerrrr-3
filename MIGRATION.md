# Source import

This repository imports the existing Home Game poker prototype. The GitHub default branch starts with an import commit; the original Git commit graph is preserved separately in `migration/source-history.bundle`.

The verified bundle includes the complete source history through `033f8987c0a4d43cb354504aaf215bd4cc40a8db` (collaboration preparation), including deployed baseline `6f35d868d34fec82181c34bb417db3aef87477b9`.

To inspect the original history without changing this working repository:

```sh
git clone migration/source-history.bundle ../pokerrrr-original-history
```

The import additionally names the package/repository `pokerrrr-3` and documents this provenance. The in-app display name remains Home Game pending design work.

Source import does not move production data or hosting. The original Site is still the live application. No GitHub Pages deployment or production deployment credentials are configured here.

Prepared backlog payloads are in `docs/issues.json`; the published issues are the working backlog. The initial checks workflow has not yet been verified on GitHub; local baseline engine/presentation tests passed (39 tests).
