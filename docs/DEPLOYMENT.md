# Deploying & Maintaining Questbook

Questbook is a static site: HTML, CSS and JavaScript, with no build step, no server code and no database. Each user's data stays in their own browser, so hosting only has to serve files. Any static host works.

- **Live site:** https://msherman16.github.io/questbook/
- **Repository:** https://github.com/msherman16/questbook
- **Hosting:** GitHub Pages, built from the `main` branch root

---

## 1. Run it locally

You need Node.js (any recent version).

```bash
git clone https://github.com/msherman16/questbook.git
cd questbook
node serve.js
```

Open http://localhost:5173. You need a local server because browsers won't load ES modules from `file://`. `serve.js` has no dependencies.

To test a first-time visit, open a private window or run `localStorage.clear()` in DevTools.

## 2. Ship an update (GitHub Pages)

1. Make your changes and test them locally.
2. **Bump the cache version** in `sw.js` (for example `questbook-v1` → `questbook-v2`). Skip this and installed users keep running the old cached files.
3. If you added a new JS or CSS file, add it to `APP_SHELL` in `sw.js` so it works offline.
4. Commit and push to `main`:
   ```bash
   git add -A
   git commit -m "Describe the change"
   git push
   ```
5. GitHub Pages redeploys in about a minute. Check progress under **Actions** or **Settings → Pages** in the repo.

After an update, users get the new version the second time they open the app: the first visit updates the cache and the next one uses it.

> **macOS note:** if `git` prints *"You have not agreed to the Xcode license agreements"*, run `sudo xcodebuild -license` once in Terminal and accept it.

## 3. First-time setup on GitHub Pages (already done; kept for reference)

1. Create a public repo and push these files to `main`.
2. Go to **Settings → Pages → Build and deployment** and choose **Deploy from a branch**, then `main` / `/ (root)`.
3. The `.nojekyll` file at the root tells Pages to serve the files as they are.
4. All asset paths are relative (`styles/…`, `js/…`, `./sw.js`), so the app works under the `/questbook/` sub-path with no changes.

### Custom domain (optional)
1. Add a `CNAME` file at the repo root that contains your domain (for example `questbook.app`).
2. At your DNS provider, add a `CNAME` record from `www` to `msherman16.github.io`. For an apex domain, add the four GitHub Pages `A` records.
3. In **Settings → Pages**, enter the domain and turn on **Enforce HTTPS**.

## 4. Other hosts

| Host | How |
| --- | --- |
| **Netlify** | Drag the project folder onto app.netlify.com/drop, or connect the GitHub repo. No build command. Publish directory: `/`. |
| **Vercel** | Import the repo. Framework preset: *Other*. No build command. Output directory: `.` |
| **Cloudflare Pages** | Connect the repo. No build command. Output directory: `/` |
| **School web server** | Copy all files to any folder served over **HTTPS**. Offline mode and installing need HTTPS. |

## 5. Pre-launch checklist

- [ ] The site loads over HTTPS and shows the setup wizard in a private window
- [ ] Finish the wizard. You land on Home with the Getting Started checklist.
- [ ] **Explore with demo data**, then **Set up my planner**, and confirm the planner is empty afterward
- [ ] Upload a file, preview it and download it
- [ ] Play each of the 4 games once
- [ ] Install it to a phone home screen, open it in airplane mode, and confirm it loads
- [ ] Export a backup and import it in a different browser
- [ ] Check dark mode and **Text size → Extra large** on a phone

## 6. Privacy & schools

- **No personal data is collected or transmitted.** There are no accounts, analytics, cookies or backend. Planner data and uploaded files stay in the user's browser (`localStorage` and IndexedDB).
- **One third-party request:** fonts load from Google Fonts, which means Google sees the visitor's IP address. For stricter environments (some K-12 districts), you can self-host the fonts:
  1. Download *Atkinson Hyperlegible* and *Lexend* (both open-source, SIL OFL).
  2. Put them in a `fonts/` folder and declare them with `@font-face` in `styles/tokens.css`.
  3. Remove the Google Fonts `<link>` tags from `index.html`.
  4. Add the font files to `APP_SHELL` in `sw.js`.
- Because nothing leaves the device, there is no server-side data to secure, export or delete. The flip side is that there is no cloud recovery: users must keep their own backups (**Settings → Export backup**).
- If you later add accounts or sync, you'll need a privacy policy. For users under 13 (US), COPPA applies, and FERPA applies if schools share student records.

## 7. Project map

```
index.html              entry point, meta tags, manifest link
manifest.webmanifest    install metadata (name, icons, colors, shortcuts)
sw.js                   offline cache (bump VERSION every release)
serve.js                local dev server
icons/                  app icons (SVG + PNG), social preview image
styles/                 tokens.css → base.css → components.css → views.css
js/app.js               shell, router, wizard gating, service-worker registration
js/store.js             all state, persistence, XP/levels/badges/quests, demo data
js/views/onboarding.js  first-run setup wizard
js/views/help.js        in-app Help & Setup page
js/views/*.js           one module per screen
docs/                   USER_GUIDE.md (for students) and this file
DESIGN_SYSTEM.md        tokens, components, voice
```

## 8. Support playbook

| Report | Likely cause | Response |
| --- | --- | --- |
| "My stuff is gone" | Different browser or device, private mode, or cleared site data | Import the latest backup. Data never syncs between devices. |
| "I don't see the update" | Old service-worker cache | Close all tabs and reopen. Confirm `VERSION` was bumped in `sw.js`. |
| "Can't install on iPhone" | Not using Safari | iOS only installs from Safari: **Share → Add to Home Screen**. |
| "Upload failed" | File over 50 MB, or device storage full | **Settings** shows how much storage is used. |
