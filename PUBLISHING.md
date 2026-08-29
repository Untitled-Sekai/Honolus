# Publishing Honolus

Packages are published from GitHub Releases through `.github/workflows/publish.yml`. Do not commit npm access tokens to this repository.

## One-time npm setup

1. Sign in to an npm account with publish access to the `untitledsekai` Organization.
2. Enable two-factor authentication on the account.
3. Confirm that the Organization scope is `@untitledsekai` and the package name is `@untitledsekai/honolus`.
4. In npm package settings, configure a GitHub Actions trusted publisher:
   - Organization or user: `Untitled-Sekai`
   - Repository: `Honolus`
   - Workflow: `publish.yml`
   - npm package: `@untitledsekai/honolus`
5. Restrict or revoke legacy automation tokens after trusted publishing works.

## Release checklist

1. Confirm the worktree only contains intended release changes.
2. Update `version` in `package.json` and `package-lock.json` with `npm version --no-git-tag-version <major|minor|patch>`.
3. Update release notes and compatibility documentation.
4. Run:

   ```bash
   npm ci
   npm run check
   npm pack --dry-run
   ```

5. Commit the version change and merge it to `main`.
6. Create a signed tag matching the package version, for example `v1.0.0`.
7. Create a GitHub Release from that tag.
8. Verify the `Publish to npm` workflow and npm provenance badge.

The same package name and version cannot be published twice. If the workflow fails after registry publication, increment the version before retrying a publish.

## Local emergency publish

Use local publishing only when trusted publishing is unavailable and package ownership has been verified:

```bash
npm whoami
npm run check
npm pack --dry-run
npm publish --access public
```

Never paste an npm token into shell history, repository files, issues, or CI logs.
