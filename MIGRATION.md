# Source import

This repository imports the original Sites poker prototype. The GitHub default branch starts with an import commit; the original Git commit graph is preserved separately in `migration/source-history.bundle`.

The verified bundle includes the complete source history through `033f8987c0a4d43cb354504aaf215bd4cc40a8db` (collaboration preparation), including deployed baseline `6f35d868d34fec82181c34bb417db3aef87477b9`.

To inspect the original history without changing this working repository:

```sh
git clone migration/source-history.bundle ../pokerrrr-original-history
```

The imported repository remains `arundevanathan/pokerrrr-3`. The current app display name is **Dunzo Club** and its package name is `dunzo-club`; historical commits and the source bundle remain unchanged.

The source bundle is provenance only; the current runtime and storage are described
in [README.md](README.md) and [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).
Importing source or building locally does not move hosted data.
