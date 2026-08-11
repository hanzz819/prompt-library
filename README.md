# Prompt Library

A searchable, fill-in-the-blank prompt library that lives in a git repo.
Plain HTML/CSS/JS — no build step, no dependencies, no server code.

- **Categorised + searchable** — sidebar categories, full-text search across title, tags, description and body
- **Fill-in fields** — anything written `[IN BRACKETS]` becomes an input; values are remembered per prompt on that device
- **One-tap copy** — copy the filled prompt from the card or the detail pane, with a "copy template" option that leaves the brackets in
- **Multi-device** — responsive down to phone width, installable to a home screen, works offline after the first visit
- **Write prompts in the app** — a real editor with per-field labels and types; new prompts work immediately, then publish them into `data/prompts.js` when you want them permanent
- **Git is the database** — prompts are one JS file of plain objects; edit, commit, push, pull

## Run it

Anywhere that serves static files. Locally:

```bash
python -m http.server 8777
```

Then open <http://localhost:8777>.

Opening `index.html` directly by double-clicking also works (the app falls back
to a copy method that does not need a secure context), but the offline cache
only turns on over `http://` or `https://`.

## Publish it (GitHub Pages)

```bash
git remote add origin https://github.com/<you>/<repo>.git && git push -u origin main
```

Then in the repo: **Settings → Pages → Source: `main` / root**. The library is
live at `https://<you>.github.io/<repo>/` a minute later — open it on a phone,
tablet, or any other machine, and add it to the home screen if you want it to
open like an app.

To keep it private, GitHub Pages on a private repo needs a paid plan; the
alternative is any static host (Netlify, Cloudflare Pages, Vercel) pointed at
the same repo, or just cloning the repo on each device and opening the file.

## On a phone

Two routes, and they are not equivalent:

| | GitHub Pages / any https host | `http://<pc-lan-ip>:8777` |
| --- | --- | --- |
| Needs the PC on | no | yes, same Wi-Fi |
| Clipboard API | yes | **no** — insecure origin |
| Copy button | one tap | falls back to `execCommand`, still one tap |
| Add to home screen | yes, with icon | yes, but reinstall when the IP changes |
| Offline | yes | no |

The LAN route serves the folder to everything on your network for as long as it
runs, so use it on a network you trust:

```bash
python -m http.server 8777 --bind 0.0.0.0
```

On iOS the copy path matters: Safari ignores `.select()` on a readonly
textarea, so the `execCommand` fallback selects through a `Range` on an
editable element instead. If a browser refuses both methods, the text appears
pre-selected in a box with a "tap Copy on the selection handle" prompt, so the
prompt is always retrievable.

**Add to Home Screen** (Share → Add to Home Screen) gives it an icon and opens
it without Safari chrome. `apple-touch-icon.png` exists because Safari ignores
the web manifest's icons.

## Add or edit a prompt

### In the app

**+** in the toolbar opens the editor. Write the prompt, and every
`[BRACKETED]` token in the body turns into a field you can label and set to
one-line or multi-line. **Save** puts it straight into the library — searchable,
categorised and copyable immediately, on that device.

Any prompt can be edited or deleted with the **✎** button in its detail pane:

| | Effect |
| --- | --- |
| Edit a device-only prompt | changes it in place |
| Edit a committed prompt | stores an override, badged *edited on this device* — `data/prompts.js` is untouched until you publish |
| **Discard my edits** on an override | committed version comes back |
| **Delete** a device-only prompt | gone immediately |
| **Delete** a committed prompt | disappears here now, and is removed from `data/prompts.js` when you publish or push. **Undo** is in the publish panel until then |

Everything written this way lives in `localStorage` and is counted by the badge
on the publish button. It exists only in that browser until published.

### Getting them into git

**↑** in the toolbar (badged with how many prompts are device-only) opens the
publish panel, with two forms of the same thing:

- **Whole prompts.js** — the complete regenerated file. Download it and replace
  `data/prompts.js`, or copy it into the GitHub web editor. Note this rewrites
  the file from the in-memory objects, so hand-written comments between prompts
  are not preserved.
- **Just my additions** — only what that device added. Paste it above the
  closing `]);`.

Then commit and push. Deletions can only be expressed by the whole-file form.

Served from `<user>.github.io/<repo>/`, the panel also shows an **Edit on
GitHub** link straight to `data/prompts.js` in the web editor.

### Committing from the app

The same panel has **Commit straight to GitHub from here** — it writes
`data/prompts.js` through the GitHub Contents API and Pages redeploys on its
own. This is the one-tap route from a phone.

It needs a token, and that is a real trade-off worth understanding:

- The token is kept in `localStorage` **in that browser only** and is sent only
  to `api.github.com`. It is never committed and never leaves for anywhere else.
- Anyone with access to that browser profile can read it. On a shared or public
  machine, use **Edit on GitHub** instead.
- Use a **fine-grained** token scoped to this single repository with
  **Contents: Read and write** — nothing more — and set an expiry.
  Create one at *Settings → Developer settings → Personal access tokens →
  Fine-grained tokens*.
- **Forget token** wipes it from the browser.

After a successful commit the app treats what it just wrote as the new
baseline, so the pending badge clears without a reload. If someone else changed
the file in between, GitHub rejects the write with a conflict and the app says
so rather than overwriting — reload and push again.

### By hand

Open `data/prompts.js`, copy an existing object, change it, give it a unique
`id`, then commit. The in-app editor is a convenience, not a requirement — the
file is always the source of truth.

### The shape of a prompt

```js
{
  id: 'plan-and-inspect',              // unique; also the #/p/<id> share link
  title: 'Plan and Inspect',
  category: 'Plan',                    // one per prompt, drives the sidebar
  tags: ['read-only', 'planning'],     // any number, searchable
  description: 'Use this prompt first.',
  fields: {                            // optional — nicer labels for the blanks
    'TASK': { label: 'Approved task', type: 'textarea', hint: 'One or two sentences.' },
    'APPROVAL OR NONE': { label: 'Owner approval', type: 'text', default: 'NONE' }
  },
  body: `Approved task:
[TASK]

Owner approval:
[APPROVAL OR NONE]`
}
```

`fields` is optional. Any `[UPPERCASE BRACKETED]` token in `body` becomes an
input whether or not it is listed there — `fields` only overrides the label,
input type (`text` / `textarea` / `select`), `options`, `rows`, `hint` and
`default`. Lowercase brackets are left alone, so ordinary markdown links inside
a prompt body are safe.

Because `body` is a JS template literal, a literal backtick must be written
`` \` `` and a literal `${` must be written `\${`.

Splitting the library across several files is fine — each file does
`window.PROMPT_LIBRARY = (window.PROMPT_LIBRARY || []).concat([ ... ]);` and gets
its own `<script>` tag in `index.html`. One file per category keeps merge
conflicts away when several people edit at once.

## Keyboard

| Key | Action |
| --- | --- |
| `/` | Focus search |
| `↑` `↓` | Move through results |
| `Ctrl`/`⌘` + `Enter` | Copy the selected prompt |
| `Esc` | Clear search, close dialog, back to the list |

## Layout

```
index.html                 markup and the script tags
assets/app.css             all styling, light + dark, responsive
assets/app.js              search, fields, copy, routing
assets/icon.svg            app icon (favicon, manifest)
assets/apple-touch-icon.png  iOS home screen icon — Safari ignores the manifest
assets/icon-512.png        Android / desktop install icon
data/prompts.js            THE LIBRARY — the only file you normally edit
sw.js                      offline cache (network first)
manifest.webmanifest       home-screen install metadata
```

## Notes

- Field values, favourites and theme are stored in `localStorage`, per device
  and per browser. They are deliberately not committed — the repo holds the
  prompts, the device holds your half-typed answers.
- A blank field stays as `[LIKE THIS]` in the copied text, and the copy toast
  tells you how many are still blank, so nothing goes out silently empty.
- `#/p/<id>` links straight to a prompt — the **Link** button copies one.
