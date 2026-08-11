# Prompt Library

A searchable, fill-in-the-blank prompt library that lives in a git repo.
Plain HTML/CSS/JS — no build step, no dependencies, no server code.

- **Categorised + searchable** — sidebar categories, full-text search across title, tags, description and body
- **Fill-in fields** — anything written `[IN BRACKETS]` becomes an input; values are remembered per prompt on that device
- **One-tap copy** — copy the filled prompt from the card or the detail pane, with a "copy template" option that leaves the brackets in
- **Multi-device** — responsive down to phone width, installable to a home screen, works offline after the first visit
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
cd "C:\Users\hanse\OneDrive\Desktop\Claude\prompt-library"; python -m http.server 8777 --bind 0.0.0.0
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

1. Open `data/prompts.js`
2. Copy an existing object, change the fields, give it a unique `id`
3. Save, commit, push

The **+** button in the app is a shortcut for step 2 — fill in the form, copy
the generated snippet, paste it into `data/prompts.js`. It never writes to the
repo itself, so nothing changes until you commit.

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
