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
| `build-site.js` | Turns `index.html` + `tools/trips-data.js` into `bundle.json` |
| `deploy.php` | Saves kit, menus, header/footer (sitewide) and pages via Elementor's document API |
| `deploy.sh` | One command: build, upload, verify, deploy, purge |

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
- Book Now links to the live site's Climb Shasta page until Flybook links are wired
- Footer badge says "Concept staging site, not live"
