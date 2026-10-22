# WordPress staging build

Builds the Elementor (classic widgets) version of the mockup on the staging site
`tcmdesign.xyz/shastamountainguides` over SSH (host alias `claymedia-staging` in `~/.ssh/config`).

Sizes and spacing use the mockup's own CSS values (`clamp()`, rem, em) through Elementor's custom units, so the
WordPress pages scale with the window exactly like the Vercel mockup.

The mockup stays the source of truth. Change the mockup first, then re-run the deploy;
pages, header, footer, menus and the global kit are updated in place (found again by `_smg_key`).

| File | What it does |
|---|---|
| `media-manifest.js` | Lists every image/PDF the mockup uses, with alt text |
| `import-media.php` | Imports them into the Media Library once; writes `media-map.json` |
| `el.js` | Helpers that produce Elementor container/widget data |
| `build-site.js` | Turns `index.html`, `tools/trips-data.js`, `tools/trip-details.json` and `tools/info-pages.json` into `bundle.json` |
| `deploy.php` | Saves kit, menus, header/footer (sitewide) and pages via Elementor's document API; sets permalinks and the redirect map |
| `mu-plugins/smg-redirects.php` | Serves the 301s in the `smg_redirects` option (uploaded by `deploy.sh`) |
| `deploy.sh` | One command: build, upload, verify, deploy, purge |

## URLs (SEO)

Every page keeps its live shastaguides.com address so rankings carry over at launch:
program pages use the live slugs (`/climbmtshasta`, `/skishasta`, `/mountaineeering`, ...; mapping in
`OLD_SLUG`), the 28 trip pages and 11 info pages use theirs (`/expedition-style`, `/gear`, `/faq`, ...), and the permalink structure
`/articles/%postname%` gives pages Squarespace's slash-less URLs while posts land at `/articles/<slug>`.
Duplicate live pages (`/glacierseminar`, ...), the mockup's file names and the live `/s/*.pdf` gear-list links
301 to their new homes.

## Re-deploy after a mockup change

```bash
NODE_PATH=<dir with node-html-parser> tools/wp/deploy.sh
```

It builds the bundle, uploads it (retrying the host's flaky SSH nodes), checks the upload by checksum,
deploys, and asks StackCache to purge. StackCache often ignores purges sent over SSH, so after a deploy
click **Purge Cache** in the WordPress admin bar, or check pages with `?v=1` added to the URL.

New images: re-run `media-manifest.js` + `import-media.php` first (existing uploads are reused).

## Staging-only settings to change at launch
- Form emails go to team@theclaymedia.com (`FORM_EMAIL` in build-site.js) → switch to info@shastaguides.com
- Footer badge says "Concept staging site, not live"
