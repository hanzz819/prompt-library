/* ---------------------------------------------------------------------------
   Prompt Library — vanilla JS, no dependencies, no build step.
   Data comes from data/prompts.js (window.PROMPT_LIBRARY).
--------------------------------------------------------------------------- */
(function () {
  'use strict';

  // REPO = what is committed in data/prompts.js.
  // LOCAL = prompts written in the app on this device, not yet in git.
  // PROMPTS = the merge the UI actually renders; a local entry sharing an id
  // with a repo prompt overrides it in place.
  var REPO = (window.PROMPT_LIBRARY || []).slice();
  var PROMPTS = [];

  /* ------------------------------ storage ------------------------------ */

  var KEY = {
    values: 'promptlib.values',
    favs: 'promptlib.favs',
    theme: 'promptlib.theme',
    local: 'promptlib.local',
    removed: 'promptlib.removed',
    gh: 'promptlib.gh',
    token: 'promptlib.ghtoken'
  };

  function load(key, fallback) {
    try {
      var raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) { return fallback; }
  }
  function save(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* private mode */ }
  }

  var state = {
    query: '',
    category: 'all',
    favOnly: false,
    selectedId: null,
    values: load(KEY.values, {}),
    favs: load(KEY.favs, []),
    theme: load(KEY.theme, 'auto'),
    local: load(KEY.local, []),
    removed: load(KEY.removed, []),
    editingId: null,
    pubMode: 'full'
  };

  // Merge REPO + LOCAL into PROMPTS. Local entries either override a repo
  // prompt of the same id (in place) or append as brand new ones. Ids in
  // state.removed are dropped — a deletion that publishes as a real removal.
  function rebuild() {
    var overridden = {};
    PROMPTS = [];
    REPO.forEach(function (p) {
      if (isRemoved(p.id)) return;
      var loc = localById(p.id);
      if (loc) { overridden[p.id] = true; PROMPTS.push(mark(loc, true)); }
      else PROMPTS.push(p);
    });
    state.local.forEach(function (loc) {
      if (!overridden[loc.id] && !isRemoved(loc.id)) PROMPTS.push(mark(loc, false));
    });
  }

  function isRemoved(id) { return state.removed.indexOf(id) > -1; }

  function mark(loc, isOverride) {
    var copy = {};
    for (var k in loc) if (Object.prototype.hasOwnProperty.call(loc, k)) copy[k] = loc[k];
    copy._local = true;
    copy._override = isOverride;
    return copy;
  }

  function localById(id) {
    for (var i = 0; i < state.local.length; i++) if (state.local[i].id === id) return state.local[i];
    return null;
  }

  function saveLocal() {
    save(KEY.local, state.local);
    save(KEY.removed, state.removed);
    rebuild();
    updatePublishBadge();
  }

  /* --------------------------- fill-in fields --------------------------- */

  // A field is any [BRACKETED TOKEN] with no lowercase letters, so ordinary
  // markdown links inside a prompt body are left alone.
  // Fresh regex per call — a shared /g regex carries lastIndex between loops.
  function slotRe() { return /\[([^\]\n]{1,90})\]/g; }

  function isSlot(token) {
    return /[A-Z]/.test(token) && token === token.toUpperCase();
  }

  function slotsOf(prompt) {
    if (prompt._slots) return prompt._slots;
    var found = [], seen = {}, m, re = slotRe();
    while ((m = re.exec(prompt.body)) !== null) {
      if (isSlot(m[1]) && !seen[m[1]]) { seen[m[1]] = 1; found.push(m[1]); }
    }
    prompt._slots = found.map(function (token) { return fieldFor(prompt, token); });
    return prompt._slots;
  }

  function fieldFor(prompt, token) {
    var meta = (prompt.fields && prompt.fields[token]) || {};
    var longish = token.length > 14 || /PASTE|LIST|PLAN|CRITERIA|ANSWERS|TASK|CONTEXT|NOTES|DETAILS|SUMMAR/.test(token);
    return {
      token: token,
      key: token,
      label: meta.label || titleCase(token),
      hint: meta.hint || '',
      type: meta.type || (meta.options ? 'select' : (longish ? 'textarea' : 'text')),
      options: meta.options || null,
      rows: meta.rows || 4,
      def: meta.default != null ? String(meta.default) : ''
    };
  }

  function titleCase(token) {
    return token.toLowerCase().replace(/\b[a-z]/g, function (c) { return c.toUpperCase(); });
  }

  function valuesFor(prompt) {
    var stored = state.values[prompt.id] || {};
    var out = {};
    slotsOf(prompt).forEach(function (f) {
      out[f.key] = stored[f.key] != null ? stored[f.key] : f.def;
    });
    return out;
  }

  function setValue(promptId, key, value) {
    if (!state.values[promptId]) state.values[promptId] = {};
    state.values[promptId][key] = value;
    save(KEY.values, state.values);
  }

  // Unfilled slots keep their [BRACKETS] so nothing goes out silently blank.
  function fill(prompt) {
    var vals = valuesFor(prompt);
    return prompt.body.replace(slotRe(), function (whole, token) {
      if (!isSlot(token)) return whole;
      var v = vals[token];
      return (v != null && String(v).trim() !== '') ? v : whole;
    });
  }

  function filledCount(prompt) {
    var vals = valuesFor(prompt), n = 0;
    slotsOf(prompt).forEach(function (f) {
      if (vals[f.key] != null && String(vals[f.key]).trim() !== '') n++;
    });
    return n;
  }

  /* ------------------------------- search ------------------------------- */

  function haystack(p) {
    if (!p._hay) {
      p._hay = [p.title, p.category, (p.tags || []).join(' '), p.description || '', p.body]
        .join(' \n ').toLowerCase();
    }
    return p._hay;
  }

  function matches(p, terms) {
    if (!terms.length) return true;
    var hay = haystack(p);
    for (var i = 0; i < terms.length; i++) if (hay.indexOf(terms[i]) === -1) return false;
    return true;
  }

  function score(p, terms) {
    var s = 0, t = p.title.toLowerCase(), c = p.category.toLowerCase(),
        g = (p.tags || []).join(' ').toLowerCase(), d = (p.description || '').toLowerCase();
    terms.forEach(function (term) {
      if (t.indexOf(term) === 0) s += 8;
      else if (t.indexOf(term) > -1) s += 5;
      if (c.indexOf(term) > -1) s += 3;
      if (g.indexOf(term) > -1) s += 2;
      if (d.indexOf(term) > -1) s += 1;
    });
    if (isFav(p.id)) s += 0.5;
    return s;
  }

  function visiblePrompts() {
    var terms = state.query.toLowerCase().split(/\s+/).filter(Boolean);
    var list = PROMPTS.filter(function (p) {
      if (state.category !== 'all' && p.category !== state.category) return false;
      if (state.favOnly && !isFav(p.id)) return false;
      return matches(p, terms);
    });
    if (terms.length) list.sort(function (a, b) { return score(b, terms) - score(a, terms); });
    return list;
  }

  /* ----------------------------- favourites ----------------------------- */

  function isFav(id) { return state.favs.indexOf(id) > -1; }
  function toggleFav(id) {
    var i = state.favs.indexOf(id);
    if (i > -1) state.favs.splice(i, 1); else state.favs.push(id);
    save(KEY.favs, state.favs);
  }

  /* ------------------------------- helpers ------------------------------ */

  var $ = function (sel) { return document.querySelector(sel); };

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function highlight(text) {
    var terms = state.query.toLowerCase().split(/\s+/).filter(Boolean);
    var out = esc(text);
    terms.forEach(function (term) {
      var re = new RegExp('(' + term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'ig');
      out = out.replace(re, '<mark>$1</mark>');
    });
    return out;
  }

  var toastTimer;
  function toast(msg) {
    var el = $('#toast');
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.classList.remove('show'); }, 1700);
  }

  // Clipboard API needs a secure context; execCommand covers file:// and http.
  function copyText(text) {
    if (navigator.clipboard && window.isSecureContext) {
      return navigator.clipboard.writeText(text).catch(legacyCopy.bind(null, text));
    }
    return legacyCopy(text);
  }

  function legacyCopy(text) {
    return new Promise(function (resolve, reject) {
      var ta = document.createElement('textarea');
      ta.value = text;
      // iOS Safari ignores .select() on a readonly textarea, so the element has
      // to stay editable and be selected through a Range. 16px avoids the
      // focus-zoom, and 1px + fixed keeps the page from jumping.
      ta.contentEditable = 'true';
      ta.readOnly = false;
      ta.style.cssText =
        'position:fixed;top:0;left:0;width:1px;height:1px;padding:0;border:0;' +
        'outline:0;opacity:0;font-size:16px;';
      document.body.appendChild(ta);

      selectAll(ta);

      var ok = false;
      try { ok = document.execCommand('copy'); } catch (e) { ok = false; }

      var sel = window.getSelection();
      if (sel) sel.removeAllRanges();
      document.body.removeChild(ta);

      ok ? resolve() : reject(new Error('copy failed'));
    });
  }

  // Selects the whole contents of a textarea in a way iOS Safari honours.
  function selectAll(ta) {
    var range = document.createRange();
    range.selectNodeContents(ta);
    var sel = window.getSelection();
    if (sel) { sel.removeAllRanges(); sel.addRange(range); }
    ta.focus();
    ta.setSelectionRange(0, ta.value.length);
  }

  // Last resort: some contexts (insecure origins, locked-down in-app browsers)
  // refuse both copy methods. Show the text pre-selected so Ctrl/⌘+C still works.
  function manualCopyFallback(text) {
    var old = document.getElementById('copyFallback');
    if (old) old.remove();

    // Touch devices have no Ctrl+C, and a readonly textarea cannot be selected
    // on iOS — so the box stays editable and the hint matches the input method.
    var touch = window.matchMedia('(hover: none)').matches;
    var hint = touch
      ? 'The text is selected — tap <b>Copy</b> on the selection handle, then <b>Done</b>.'
      : 'The text is selected — press <kbd>Ctrl</kbd>/<kbd>⌘</kbd>+<kbd>C</kbd>, then <kbd>Esc</kbd>.';

    var wrap = document.createElement('div');
    wrap.id = 'copyFallback';
    wrap.className = 'copy-fallback';
    wrap.innerHTML =
      '<div class="copy-fallback-card">' +
        '<p class="copy-fallback-note">This browser blocked the clipboard. ' + hint + '</p>' +
        '<textarea spellcheck="false"></textarea>' +
        '<button class="btn ghost">Done</button>' +
      '</div>';

    var ta = wrap.querySelector('textarea');
    ta.value = text;

    function close() { wrap.remove(); document.removeEventListener('keydown', onKey); }
    function onKey(e) { if (e.key === 'Escape') close(); }

    wrap.addEventListener('click', function (e) { if (e.target === wrap) close(); });
    wrap.querySelector('button').onclick = close;
    document.addEventListener('keydown', onKey);

    document.body.appendChild(wrap);
    selectAll(ta);
  }

  function byId(id) {
    for (var i = 0; i < PROMPTS.length; i++) if (PROMPTS[i].id === id) return PROMPTS[i];
    return null;
  }

  /* ------------------------------ rendering ----------------------------- */

  function categories() {
    var map = {}, order = [];
    PROMPTS.forEach(function (p) {
      if (!map[p.category]) { map[p.category] = 0; order.push(p.category); }
      map[p.category]++;
    });
    return order.map(function (name) { return { name: name, count: map[name] }; });
  }

  function renderCategories() {
    var cats = categories();
    var nav = $('#cats'), chips = $('#chipsRow');
    var all = { name: 'all', count: PROMPTS.length };

    nav.innerHTML = '';
    chips.innerHTML = '';

    [all].concat(cats).forEach(function (c) {
      var label = c.name === 'all' ? 'All prompts' : c.name;
      var current = state.category === c.name;

      var btn = document.createElement('button');
      btn.className = 'cat';
      btn.setAttribute('aria-current', current ? 'true' : 'false');
      btn.innerHTML = '<span>' + esc(label) + '</span><span class="n">' + c.count + '</span>';
      btn.onclick = function () { state.category = c.name; renderCategories(); renderList(); };
      nav.appendChild(btn);

      var chip = document.createElement('button');
      chip.className = 'chip';
      chip.setAttribute('aria-current', current ? 'true' : 'false');
      chip.textContent = label;
      chip.onclick = btn.onclick;
      chips.appendChild(chip);
    });

    var dl = $('#catList');
    dl.innerHTML = cats.map(function (c) { return '<option value="' + esc(c.name) + '">'; }).join('');
  }

  function renderList() {
    var list = visiblePrompts();
    var ul = $('#list');
    ul.innerHTML = '';

    $('#resultCount').textContent = list.length === PROMPTS.length
      ? PROMPTS.length + (PROMPTS.length === 1 ? ' prompt' : ' prompts')
      : list.length + ' of ' + PROMPTS.length;

    $('#emptyState').hidden = list.length > 0;

    list.forEach(function (p) {
      var li = document.createElement('li');
      var card = document.createElement('div');
      card.className = 'card';
      card.tabIndex = 0;
      card.setAttribute('role', 'button');
      card.dataset.id = p.id;
      card.setAttribute('aria-current', state.selectedId === p.id ? 'true' : 'false');

      var slots = slotsOf(p);
      var fieldsLabel = slots.length
        ? filledCount(p) + '/' + slots.length + ' filled'
        : 'no fields';

      card.innerHTML =
        '<div class="card-top"><span class="card-title">' + highlight(p.title) + '</span></div>' +
        (p.description ? '<p class="card-desc">' + highlight(p.description) + '</p>' : '') +
        '<div class="card-foot">' +
          '<span class="tag cat-tag">' + esc(p.category) + '</span>' +
          '<span class="tag fields-tag">' + fieldsLabel + '</span>' +
          (p._local ? '<span class="tag local-tag">' + (p._override ? 'edited' : 'not in git') + '</span>' : '') +
        '</div>' +
        '<div class="card-actions">' +
          '<button class="icon-btn" data-act="fav" aria-pressed="' + (isFav(p.id) ? 'true' : 'false') +
            '" title="Favourite">' + (isFav(p.id) ? '★' : '☆') + '</button>' +
          '<button class="icon-btn" data-act="copy" title="Copy this prompt">⧉</button>' +
        '</div>';

      card.addEventListener('click', function (e) {
        var act = e.target.getAttribute && e.target.getAttribute('data-act');
        if (act === 'fav') { e.stopPropagation(); toggleFav(p.id); renderList(); renderDetail(); return; }
        if (act === 'copy') { e.stopPropagation(); doCopy(fill(p), null, p); return; }
        select(p.id);
      });
      card.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); select(p.id); }
      });

      li.appendChild(card);
      ul.appendChild(li);
    });
  }

  function renderDetail() {
    var pane = $('#detail');
    var p = state.selectedId ? byId(state.selectedId) : null;

    if (!p) {
      pane.innerHTML = '<div class="detail-placeholder">Pick a prompt to fill it in and copy it.</div>';
      return;
    }

    var slots = slotsOf(p);
    var wrap = document.createElement('div');
    wrap.className = 'detail-inner';

    var head = '<div class="d-head"><h1 class="d-title">' + esc(p.title) + '</h1>' +
      '<button class="icon-btn" id="dEdit" title="Edit this prompt">✎</button>' +
      '<button class="icon-btn" id="dFav" aria-pressed="' + (isFav(p.id) ? 'true' : 'false') +
      '" title="Favourite">' + (isFav(p.id) ? '★' : '☆') + '</button></div>' +
      '<div class="d-meta"><span class="tag cat-tag">' + esc(p.category) + '</span>' +
      (p._local ? '<span class="tag local-tag">' + (p._override ? 'edited on this device' : 'not in git yet') + '</span>' : '') +
      (p.tags || []).map(function (t) { return '<span class="tag">' + esc(t) + '</span>'; }).join('') +
      '</div>' +
      (p.description ? '<p class="d-desc">' + esc(p.description) + '</p>' : '');

    var fieldsHtml = '';
    if (slots.length) {
      fieldsHtml =
        '<div class="section"><div class="section-head">' +
          '<h2 class="section-title">Fill in</h2>' +
          '<span class="progress" id="dProgress"></span>' +
        '</div><div class="fields" id="dFields"></div></div>';
    }

    var previewHtml =
      '<div class="section"><div class="section-head">' +
        '<h2 class="section-title">Prompt</h2>' +
      '</div><pre class="preview" id="dPreview"></pre></div>';

    var actionsHtml =
      '<div class="actions">' +
        '<button class="btn primary" id="dCopy">Copy prompt</button>' +
        (slots.length ? '<button class="btn" id="dCopyRaw" title="Copy with the [BRACKETS] left in">Copy template</button>' : '') +
        (slots.length ? '<button class="btn ghost" id="dReset">Reset fields</button>' : '') +
        '<button class="btn ghost" id="dShare" title="Copy a direct link to this prompt">Link</button>' +
      '</div>';

    wrap.innerHTML = head + fieldsHtml + previewHtml + actionsHtml;
    pane.innerHTML = '';
    pane.appendChild(wrap);
    pane.scrollTop = 0;

    // inputs
    if (slots.length) {
      var host = wrap.querySelector('#dFields');
      var vals = valuesFor(p);
      slots.forEach(function (f) {
        var lab = document.createElement('label');
        lab.className = 'fld';
        var input;

        if (f.type === 'select') {
          input = document.createElement('select');
          f.options.forEach(function (o) {
            var opt = document.createElement('option');
            opt.value = o; opt.textContent = o;
            input.appendChild(opt);
          });
        } else if (f.type === 'textarea') {
          input = document.createElement('textarea');
          input.rows = f.rows;
        } else {
          input = document.createElement('input');
          input.type = 'text';
        }

        input.value = vals[f.key] || '';
        input.placeholder = '[' + f.token + ']';
        input.setAttribute('aria-label', f.label);

        var span = document.createElement('span');
        span.innerHTML = esc(f.label) + (f.hint ? ' <em>— ' + esc(f.hint) + '</em>' : '');

        lab.appendChild(span);
        lab.appendChild(input);
        host.appendChild(lab);

        input.addEventListener('input', function () {
          setValue(p.id, f.key, input.value);
          lab.classList.toggle('missing', input.value.trim() === '');
          updatePreview(p);
          updateProgress(p);
        });
        lab.classList.toggle('missing', (vals[f.key] || '').trim() === '');
      });
    }

    updatePreview(p);
    updateProgress(p);

    wrap.querySelector('#dFav').onclick = function () { toggleFav(p.id); renderDetail(); renderList(); };
    wrap.querySelector('#dEdit').onclick = function () { openEditor(p); };
    wrap.querySelector('#dCopy').onclick = function (e) { doCopy(fill(p), e.currentTarget, p); };
    if (wrap.querySelector('#dCopyRaw')) {
      wrap.querySelector('#dCopyRaw').onclick = function (e) { doCopy(p.body, e.currentTarget, null); };
    }
    if (wrap.querySelector('#dReset')) {
      wrap.querySelector('#dReset').onclick = function () {
        delete state.values[p.id];
        save(KEY.values, state.values);
        renderDetail(); renderList();
        toast('Fields reset');
      };
    }
    wrap.querySelector('#dShare').onclick = function () {
      var url = location.origin + location.pathname + '#/p/' + p.id;
      copyText(url).then(function () { toast('Link copied'); },
                        function () { manualCopyFallback(url); });
    };
  }

  function updatePreview(p) {
    var el = document.getElementById('dPreview');
    if (!el) return;
    var vals = valuesFor(p);
    var html = '';
    var last = 0, m, re = slotRe();
    while ((m = re.exec(p.body)) !== null) {
      if (!isSlot(m[1])) continue;
      html += esc(p.body.slice(last, m.index));
      var v = vals[m[1]];
      if (v != null && String(v).trim() !== '') {
        html += '<span class="slot-filled">' + esc(v) + '</span>';
      } else {
        html += '<span class="slot-empty">[' + esc(m[1]) + ']</span>';
      }
      last = m.index + m[0].length;
    }
    html += esc(p.body.slice(last));
    el.innerHTML = html;
  }

  function updateProgress(p) {
    var el = document.getElementById('dProgress');
    if (!el) return;
    var total = slotsOf(p).length, done = filledCount(p);
    el.textContent = done + ' of ' + total + ' filled';
    el.classList.toggle('done', done === total);
    var card = document.querySelector('.card[data-id="' + p.id + '"] .fields-tag');
    if (card) card.textContent = done + '/' + total + ' filled';
  }

  function doCopy(text, btn, prompt) {
    copyText(text).then(function () {
      var missing = prompt ? slotsOf(prompt).length - filledCount(prompt) : 0;
      toast(missing > 0
        ? 'Copied — ' + missing + ' field' + (missing === 1 ? '' : 's') + ' still blank'
        : 'Copied to clipboard');
      if (btn) {
        var original = btn.textContent;
        btn.textContent = '✓ Copied';
        btn.classList.add('copied');
        setTimeout(function () { btn.textContent = original; btn.classList.remove('copied'); }, 1400);
      }
    }, function () {
      manualCopyFallback(text);
    });
  }

  /* ------------------------------ selection ----------------------------- */

  function select(id, skipHash) {
    state.selectedId = id;
    if (!skipHash) {
      try { history.replaceState(null, '', '#/p/' + id); } catch (e) { location.hash = '/p/' + id; }
    }
    document.body.dataset.view = 'detail';
    renderList();
    renderDetail();
    if (window.matchMedia('(max-width: 760px)').matches) window.scrollTo(0, 0);
  }

  function showList() {
    document.body.dataset.view = 'list';
    try { history.replaceState(null, '', location.pathname + location.search); } catch (e) {}
  }

  function fromHash() {
    var m = location.hash.match(/^#\/p\/(.+)$/);
    if (m && byId(decodeURIComponent(m[1]))) select(decodeURIComponent(m[1]), true);
  }

  /* -------------------------------- theme ------------------------------- */

  function applyTheme() {
    document.documentElement.setAttribute('data-theme', state.theme);
    var icons = { auto: '◐', light: '☀', dark: '☾' };
    var btn = $('#themeBtn');
    btn.textContent = icons[state.theme];
    btn.title = 'Theme: ' + state.theme + ' (click to change)';
  }

  /* ---------------------------- prompt editor --------------------------- */

  function slugify(s) {
    return s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'untitled';
  }

  function uniqueId(base, keepId) {
    var id = base, n = 2;
    while (byId(id) && id !== keepId) id = base + '-' + (n++);
    return id;
  }

  function detectSlots(body) {
    var found = [], seen = {}, m, re = slotRe();
    while ((m = re.exec(body)) !== null) {
      if (isSlot(m[1]) && !seen[m[1]]) { seen[m[1]] = 1; found.push(m[1]); }
    }
    return found;
  }

  var editorMeta = {};

  function openEditor(prompt) {
    state.editingId = prompt ? prompt.id : null;
    editorMeta = {};
    if (prompt && prompt.fields) {
      for (var k in prompt.fields) {
        if (Object.prototype.hasOwnProperty.call(prompt.fields, k)) {
          var src = prompt.fields[k], copy = {};
          for (var j in src) if (Object.prototype.hasOwnProperty.call(src, j)) copy[j] = src[j];
          editorMeta[k] = copy;
        }
      }
    }

    $('#modalTitle').textContent = prompt ? 'Edit prompt' : 'Write a prompt';
    $('#npTitle').value = prompt ? prompt.title : '';
    $('#npCategory').value = prompt ? prompt.category : '';
    $('#npTags').value = prompt ? (prompt.tags || []).join(', ') : '';
    $('#npDesc').value = prompt ? (prompt.description || '') : '';
    $('#npBody').value = prompt ? prompt.body : '';

    var note = $('#editorNote');
    if (prompt && !prompt._local) {
      note.innerHTML = 'This prompt is committed in <code>data/prompts.js</code>. Saving keeps the ' +
        'file untouched and stores an override on this device — publish it to make the change permanent.';
    } else if (prompt) {
      note.innerHTML = 'Saved on this device only. Use <b>Publish</b> in the toolbar to get it into git.';
    } else {
      note.innerHTML = 'Saves straight into the library on this device — usable immediately. ' +
        'Use <b>Publish</b> in the toolbar when you want it committed to git.';
    }

    // Delete is available for every prompt. For a committed one it records a
    // removal that takes effect when published, not a silent local hide.
    var del = $('#npDelete');
    del.hidden = !prompt;
    if (prompt) {
      del.textContent = prompt._local && !prompt._override ? 'Delete'
        : prompt._override ? 'Discard my edits'
        : 'Delete';
    }
    renderFieldMeta();
    $('#modal').hidden = false;
    $('#npTitle').focus();
  }

  function renderFieldMeta() {
    var host = $('#npFields');
    var slots = detectSlots($('#npBody').value);
    host.innerHTML = '';

    if (!slots.length) {
      host.innerHTML = '<p class="fieldmeta-empty">No fields yet — anything you write as ' +
        '<code>[LIKE THIS]</code> in the body becomes an input.</p>';
      return;
    }

    slots.forEach(function (token) {
      if (!editorMeta[token]) {
        editorMeta[token] = { label: titleCase(token), type: token.length > 14 ? 'textarea' : 'text' };
      }
      var meta = editorMeta[token];

      var row = document.createElement('div');
      row.className = 'fieldmeta-row';
      row.innerHTML =
        '<code class="fieldmeta-token">[' + esc(token) + ']</code>' +
        '<input type="text" class="fieldmeta-label" value="' + esc(meta.label || '') + '" placeholder="Label">' +
        '<select class="fieldmeta-type">' +
          '<option value="text">one line</option>' +
          '<option value="textarea">multi-line</option>' +
        '</select>';

      var sel = row.querySelector('select');
      sel.value = meta.type === 'textarea' ? 'textarea' : 'text';
      sel.addEventListener('change', function () { meta.type = sel.value; });
      row.querySelector('input').addEventListener('input', function (e) { meta.label = e.target.value; });

      host.appendChild(row);
    });
  }

  function saveEditor() {
    var title = $('#npTitle').value.trim();
    if (!title) { $('#npTitle').focus(); toast('A title is required'); return; }

    var body = $('#npBody').value;
    if (!body.trim()) { $('#npBody').focus(); toast('The prompt body is empty'); return; }

    var slots = detectSlots(body);
    var fields = {};
    slots.forEach(function (t) { if (editorMeta[t]) fields[t] = editorMeta[t]; });

    var prompt = {
      id: state.editingId || uniqueId(slugify(title), null),
      title: title,
      category: $('#npCategory').value.trim() || 'General',
      tags: $('#npTags').value.split(',').map(function (t) { return t.trim(); }).filter(Boolean),
      description: $('#npDesc').value.trim(),
      body: body
    };
    if (slots.length) prompt.fields = fields;

    var existing = localById(prompt.id);
    if (existing) state.local[state.local.indexOf(existing)] = prompt;
    else state.local.push(prompt);

    saveLocal();
    closeModal();
    renderCategories();
    select(prompt.id);
    toast(existing ? 'Prompt updated' : 'Prompt added');
  }

  // One delete for all three cases: a device-only prompt, an override of a
  // committed prompt, or a committed prompt itself.
  function deletePrompt(id) {
    var loc = localById(id);
    var inRepo = !!byIdIn(REPO, id);

    if (loc && inRepo) {                       // discard the override only
      state.local.splice(state.local.indexOf(loc), 1);
      saveLocal();
      closeModal();
      renderCategories();
      select(id);
      toast('Your edits were discarded — showing the committed version');
      return;
    }

    if (loc && !inRepo) {                      // device-only prompt, just drop it
      state.local.splice(state.local.indexOf(loc), 1);
      forgetValues(id);
      saveLocal();
      afterRemoval('Prompt deleted');
      return;
    }

    if (inRepo) {                              // committed — needs publishing to take effect
      var p = byId(id);
      if (!window.confirm('Delete "' + (p ? p.title : id) + '"?\n\n' +
          'It disappears here now, and is removed from data/prompts.js when you publish or push.')) return;
      state.removed.push(id);
      forgetValues(id);
      saveLocal();
      afterRemoval('Deleted — publish or push to remove it from git');
    }
  }

  function forgetValues(id) {
    delete state.values[id];
    save(KEY.values, state.values);
    var f = state.favs.indexOf(id);
    if (f > -1) { state.favs.splice(f, 1); save(KEY.favs, state.favs); }
  }

  function afterRemoval(msg) {
    closeModal();
    state.selectedId = null;
    renderCategories();
    showList();
    renderList();
    renderDetail();
    toast(msg);
  }

  function restoreRemoved(id) {
    var i = state.removed.indexOf(id);
    if (i > -1) state.removed.splice(i, 1);
    saveLocal();
    renderCategories();
    renderList();
    renderPublish();
    toast('Restored');
  }

  function byIdIn(list, id) {
    for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
    return null;
  }

  function closeModal() { $('#modal').hidden = true; state.editingId = null; }

  /* ------------------------- publish (git export) ----------------------- */

  var FILE_HEADER = [
    '/* ---------------------------------------------------------------------------',
    '   THE LIBRARY LIVES HERE.',
    '',
    '   Add a prompt = add an object to the array below, save, commit, push.',
    '   Every device gets it on the next load. No build step, no database.',
    '',
    '   Fields (fill-in-the-blanks) are written [IN SQUARE BRACKETS] inside `body`.',
    '   They are detected automatically; the optional `fields` map just gives them',
    '   nicer labels, input types and defaults.',
    '',
    '   Careful: `body` is a JS template literal, so a literal backtick must be',
    '   written \\` and a literal ${ must be written \\${.',
    '--------------------------------------------------------------------------- */',
    '',
    'window.PROMPT_LIBRARY = (window.PROMPT_LIBRARY || []).concat([',
    ''
  ].join('\n');

  function jsStr(s) {
    return "'" + String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n') + "'";
  }
  function jsTmpl(s) {
    return '`' + String(s).replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$\{/g, '\\${') + '`';
  }

  function serializePrompt(p) {
    var out = ['{'];
    out.push('  id: ' + jsStr(p.id) + ',');
    out.push('  title: ' + jsStr(p.title) + ',');
    out.push('  category: ' + jsStr(p.category) + ',');
    out.push('  tags: [' + (p.tags || []).map(jsStr).join(', ') + '],');
    if (p.description) {
      // a template literal so multi-line descriptions stay valid and readable
      out.push('  description: ' + (p.description.indexOf('\n') > -1 ? jsTmpl(p.description) : jsStr(p.description)) + ',');
    }
    var keys = p.fields ? Object.keys(p.fields) : [];
    if (keys.length) {
      out.push('  fields: {');
      out.push(keys.map(function (k) {
        var f = p.fields[k], parts = [];
        if (f.label) parts.push('label: ' + jsStr(f.label));
        if (f.type) parts.push('type: ' + jsStr(f.type));
        if (f.hint) parts.push('hint: ' + jsStr(f.hint));
        if (f.options) parts.push('options: [' + f.options.map(jsStr).join(', ') + ']');
        if (f.rows) parts.push('rows: ' + f.rows);
        if (f['default'] != null && f['default'] !== '') parts.push('default: ' + jsStr(f['default']));
        return '    ' + jsStr(k) + ': { ' + parts.join(', ') + ' }';
      }).join(',\n'));
      out.push('  },');
    }
    out.push('  body: ' + jsTmpl(p.body));
    out.push('}');
    return out.join('\n');
  }

  function buildFullFile() {
    return FILE_HEADER + '\n' +
      PROMPTS.map(serializePrompt).join(',\n\n') +
      '\n\n]);\n';
  }

  function buildAdditions() {
    var locals = PROMPTS.filter(function (p) { return p._local; });
    if (!locals.length) return '';
    return locals.map(serializePrompt).join(',\n\n') + ',';
  }

  // Turn https://user.github.io/repo/ into the repo's file editor, when hosted there.
  function githubEditUrl() {
    var m = location.hostname.match(/^([^.]+)\.github\.io$/);
    if (!m) return null;
    var repo = location.pathname.split('/').filter(Boolean)[0];
    if (!repo) return null;
    return 'https://github.com/' + m[1] + '/' + repo + '/edit/main/data/prompts.js';
  }

  function pendingCount() {
    return PROMPTS.filter(function (p) { return p._local; }).length + state.removed.length;
  }

  function updatePublishBadge() {
    var n = pendingCount(), el = $('#publishCount');
    el.textContent = n;
    el.hidden = n === 0;
    $('#publishBtn').title = n
      ? n + ' unpublished change' + (n === 1 ? '' : 's') + ' on this device'
      : 'Everything here is already in git';
  }

  function openPublish() {
    renderPublish();
    $('#publish').hidden = false;
  }

  function renderPublish() {
    var locals = PROMPTS.filter(function (p) { return p._local; });
    var gh = githubEditUrl();
    var pending = pendingCount();

    $('#pubNote').innerHTML = pending
      ? 'These changes live in this browser only. Get them into <code>data/prompts.js</code> ' +
        'and every device picks them up on the next load.'
      : 'Nothing pending — the library matches <code>data/prompts.js</code>. ' +
        'You can still export or re-push the file below.';

    var rows = locals.map(function (p) {
      return '<div class="pub-item"><span class="tag ' + (p._override ? 'warn-tag' : 'cat-tag') + '">' +
        (p._override ? 'edited' : 'new') + '</span><span class="pub-name">' + esc(p.title) + '</span></div>';
    });
    state.removed.forEach(function (id) {
      var was = byIdIn(REPO, id);
      rows.push('<div class="pub-item"><span class="tag warn-tag">deleted</span>' +
        '<span class="pub-name">' + esc(was ? was.title : id) + '</span>' +
        '<button class="link-btn" data-restore="' + esc(id) + '">Undo</button></div>');
    });
    $('#pubList').innerHTML = rows.join('');

    var full = state.pubMode === 'full';
    $('#segFull').setAttribute('aria-selected', full ? 'true' : 'false');
    $('#segSnippet').setAttribute('aria-selected', full ? 'false' : 'true');
    $('#segNote').innerHTML = full
      ? 'The complete file, every prompt included. <b>Replace</b> <code>data/prompts.js</code> with this.'
      : 'Only what this device added. <b>Paste</b> it just above the closing <code>]);</code>.' +
        (state.removed.length ? ' <b>Deletions are not in this mode</b> — use the whole file for those.' : '');

    $('#pubOut').value = full ? buildFullFile() : (buildAdditions() || '(nothing added on this device)');
    $('#pubDownload').hidden = !full;

    var a = $('#pubGithub');
    if (gh) { a.href = gh; a.hidden = false; } else { a.hidden = true; }

    renderPushForm();
  }

  /* --------------------------- push to GitHub --------------------------- */

  function ghConfig() {
    var saved = load(KEY.gh, null);
    if (saved && saved.owner) return saved;
    var m = location.hostname.match(/^([^.]+)\.github\.io$/);
    return {
      owner: m ? m[1] : '',
      repo: m ? (location.pathname.split('/').filter(Boolean)[0] || '') : '',
      branch: 'main',
      path: 'data/prompts.js'
    };
  }

  function readPushForm() {
    var cfg = {
      owner: $('#ghOwner').value.trim(),
      repo: $('#ghRepo').value.trim(),
      branch: $('#ghBranch').value.trim() || 'main',
      path: $('#ghPath').value.trim() || 'data/prompts.js'
    };
    save(KEY.gh, cfg);
    return cfg;
  }

  function renderPushForm() {
    var cfg = ghConfig();
    $('#ghOwner').value = cfg.owner;
    $('#ghRepo').value = cfg.repo;
    $('#ghBranch').value = cfg.branch;
    $('#ghPath').value = cfg.path;

    var hasToken = !!load(KEY.token, '');
    $('#ghToken').placeholder = hasToken ? '•••••••• saved in this browser' : 'github_pat_…';
    $('#ghForget').hidden = !hasToken;

    // refresh the suggestion unless it has been edited by hand
    var msg = $('#ghMsg');
    if (!msg.value || msg.value.indexOf('Update prompt library') === 0) {
      var n = pendingCount();
      msg.value = n ? 'Update prompt library (' + n + ' change' + (n === 1 ? '' : 's') + ')'
                    : 'Update prompt library';
    }
  }

  function pushStatus(msg, kind) {
    var el = $('#ghStatus');
    el.textContent = msg;
    el.className = 'push-status' + (kind ? ' ' + kind : '');
  }

  // UTF-8 safe base64 — prompt bodies contain smart quotes and em dashes.
  function toBase64(str) {
    var bytes = new TextEncoder().encode(str), bin = '';
    for (var i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    return btoa(bin);
  }

  function ghApi(path, method, body) {
    var headers = {
      'Accept': 'application/vnd.github+json',
      'Authorization': 'Bearer ' + load(KEY.token, ''),
      'X-GitHub-Api-Version': '2022-11-28'
    };
    if (body) headers['Content-Type'] = 'application/json';
    return fetch('https://api.github.com' + path, {
      method: method || 'GET',
      headers: headers,
      body: body ? JSON.stringify(body) : undefined
    }).then(function (res) {
      return res.json().catch(function () { return {}; }).then(function (json) {
        return { ok: res.ok, status: res.status, json: json };
      });
    });
  }

  function ghError(r) {
    if (r.status === 401) return 'Token rejected — it may be wrong or expired.';
    if (r.status === 403) return 'Token lacks permission — it needs Contents: Read and write on this repo.';
    if (r.status === 404) return 'Repo, branch or path not found, or the token cannot see this repo.';
    if (r.status === 409) return 'The file changed on GitHub since this page loaded. Reload, then push again.';
    if (r.status === 422) return 'GitHub rejected the commit: ' + (r.json.message || 'unprocessable');
    return 'GitHub returned ' + r.status + (r.json.message ? ' — ' + r.json.message : '');
  }

  function pushToGitHub() {
    var token = ($('#ghToken').value || '').trim();
    if (token) { save(KEY.token, token); $('#ghToken').value = ''; renderPushForm(); }
    if (!load(KEY.token, '')) { pushStatus('Add a token first.', 'bad'); $('#ghToken').focus(); return; }

    var cfg = readPushForm();
    if (!cfg.owner || !cfg.repo) { pushStatus('Owner and repository are required.', 'bad'); return; }

    var content = buildFullFile();
    var message = $('#ghMsg').value.trim() || 'Update prompt library';
    var base = '/repos/' + cfg.owner + '/' + cfg.repo + '/contents/' + cfg.path;

    $('#ghPush').disabled = true;
    pushStatus('Reading the current file…');

    ghApi(base + '?ref=' + encodeURIComponent(cfg.branch))
      .then(function (r) {
        if (!r.ok && r.status !== 404) throw new Error(ghError(r));
        pushStatus('Committing…');
        return ghApi(base, 'PUT', {
          message: message,
          content: toBase64(content),
          branch: cfg.branch,
          sha: r.ok ? r.json.sha : undefined
        });
      })
      .then(function (r) {
        if (!r.ok) throw new Error(ghError(r));
        var sha = (r.json.commit && r.json.commit.sha || '').slice(0, 7);
        adoptPushedState();
        pushStatus('✓ Committed ' + sha + '. Pages redeploys in about a minute.', 'good');
        toast('Pushed to GitHub');
      })
      .catch(function (e) {
        pushStatus('✗ ' + e.message, 'bad');
      })
      .then(function () { $('#ghPush').disabled = false; });
  }

  // After a successful commit the remote file is exactly what we just built,
  // so the merged view becomes the new baseline and nothing stays pending.
  function adoptPushedState() {
    REPO = PROMPTS.map(plain);
    state.local = [];
    state.removed = [];
    saveLocal();
    renderCategories();
    renderList();
    renderDetail();
    renderPublish();
  }

  function plain(p) {
    var out = {};
    for (var k in p) {
      if (Object.prototype.hasOwnProperty.call(p, k) && k.charAt(0) !== '_') out[k] = p[k];
    }
    return out;
  }

  function downloadFile(name, text) {
    try {
      var blob = new Blob([text], { type: 'text/javascript' });
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url; a.download = name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
      toast('Downloaded ' + name);
    } catch (e) {
      manualCopyFallback(text);
    }
  }

  /* ------------------------------- events ------------------------------- */

  function wire() {
    var searchEl = $('#search');
    var debounce;
    searchEl.addEventListener('input', function () {
      clearTimeout(debounce);
      debounce = setTimeout(function () {
        state.query = searchEl.value.trim();
        $('#clearSearch').hidden = !state.query;
        renderList();
      }, 80);
    });

    $('#clearSearch').onclick = function () {
      searchEl.value = ''; state.query = '';
      $('#clearSearch').hidden = true;
      renderList(); searchEl.focus();
    };

    $('#favToggle').onclick = function (e) {
      state.favOnly = !state.favOnly;
      e.currentTarget.setAttribute('aria-pressed', state.favOnly ? 'true' : 'false');
      e.currentTarget.textContent = state.favOnly ? '★' : '☆';
      renderList();
    };

    $('#themeBtn').onclick = function () {
      var order = ['auto', 'light', 'dark'];
      state.theme = order[(order.indexOf(state.theme) + 1) % order.length];
      save(KEY.theme, state.theme);
      applyTheme();
    };

    $('#backBtn').onclick = showList;
    $('#newBtn').onclick = function () { openEditor(null); };
    $('#publishBtn').onclick = openPublish;

    $('#modal').addEventListener('click', function (e) {
      if (e.target.getAttribute('data-close')) closeModal();
    });
    $('#npBody').addEventListener('input', renderFieldMeta);
    $('#npSave').onclick = saveEditor;
    $('#npDelete').onclick = function () {
      if (state.editingId) deletePrompt(state.editingId);
    };

    $('#publish').addEventListener('click', function (e) {
      if (e.target.getAttribute('data-close')) { $('#publish').hidden = true; return; }
      var restore = e.target.getAttribute && e.target.getAttribute('data-restore');
      if (restore) restoreRemoved(restore);
    });
    $('#ghPush').onclick = pushToGitHub;
    $('#ghForget').onclick = function () {
      try { localStorage.removeItem(KEY.token); } catch (err) {}
      $('#ghToken').value = '';
      renderPushForm();
      pushStatus('Token removed from this browser.');
    };
    $('#segFull').onclick = function () { state.pubMode = 'full'; renderPublish(); };
    $('#segSnippet').onclick = function () { state.pubMode = 'snippet'; renderPublish(); };
    $('#pubCopy').onclick = function (e) { doCopy($('#pubOut').value, e.currentTarget, null); };
    $('#pubDownload').onclick = function () { downloadFile('prompts.js', buildFullFile()); };

    window.addEventListener('hashchange', fromHash);

    document.addEventListener('keydown', function (e) {
      // the manual-copy escape owns the keyboard while it is open
      if (document.getElementById('copyFallback')) return;

      var typing = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName);

      if (e.key === '/' && !typing) { e.preventDefault(); searchEl.focus(); searchEl.select(); return; }

      if (e.key === 'Escape') {
        if (!$('#publish').hidden) { $('#publish').hidden = true; return; }
        if (!$('#modal').hidden) { closeModal(); return; }
        if (document.activeElement === searchEl && searchEl.value) { $('#clearSearch').click(); return; }
        if (document.body.dataset.view === 'detail' &&
            window.matchMedia('(max-width: 760px)').matches) { showList(); return; }
      }

      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        var p = state.selectedId && byId(state.selectedId);
        if (p) { e.preventDefault(); doCopy(fill(p), document.getElementById('dCopy'), p); }
        return;
      }

      if ((e.key === 'ArrowDown' || e.key === 'ArrowUp') && (!typing || document.activeElement === searchEl)) {
        var list = visiblePrompts();
        if (!list.length) return;
        e.preventDefault();
        var idx = list.findIndex(function (x) { return x.id === state.selectedId; });
        idx = e.key === 'ArrowDown' ? Math.min(idx + 1, list.length - 1) : Math.max(idx - 1, 0);
        if (idx < 0) idx = 0;
        select(list[idx].id);
        var card = document.querySelector('.card[data-id="' + list[idx].id + '"]');
        if (card) card.scrollIntoView({ block: 'nearest' });
      }
    });
  }

  /* -------------------------------- boot -------------------------------- */

  function init() {
    rebuild();
    applyTheme();
    wire();
    updatePublishBadge();
    renderCategories();
    renderList();
    renderDetail();
    fromHash();

    if ('serviceWorker' in navigator && location.protocol.indexOf('http') === 0) {
      navigator.serviceWorker.register('sw.js').catch(function () { /* offline cache is optional */ });
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
