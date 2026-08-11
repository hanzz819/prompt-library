/* ---------------------------------------------------------------------------
   Prompt Library — vanilla JS, no dependencies, no build step.
   Data comes from data/prompts.js (window.PROMPT_LIBRARY).
--------------------------------------------------------------------------- */
(function () {
  'use strict';

  var PROMPTS = (window.PROMPT_LIBRARY || []).slice();

  /* ------------------------------ storage ------------------------------ */

  var KEY = { values: 'promptlib.values', favs: 'promptlib.favs', theme: 'promptlib.theme' };

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
    theme: load(KEY.theme, 'auto')
  };

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
      ta.setAttribute('readonly', '');
      ta.style.cssText = 'position:fixed;top:0;left:0;opacity:0;';
      document.body.appendChild(ta);
      ta.select();
      ta.setSelectionRange(0, ta.value.length);
      var ok = false;
      try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
      document.body.removeChild(ta);
      ok ? resolve() : reject(new Error('copy failed'));
    });
  }

  // Last resort: some contexts (insecure origins, locked-down in-app browsers)
  // refuse both copy methods. Show the text pre-selected so Ctrl/⌘+C still works.
  function manualCopyFallback(text) {
    var old = document.getElementById('copyFallback');
    if (old) old.remove();

    var wrap = document.createElement('div');
    wrap.id = 'copyFallback';
    wrap.className = 'copy-fallback';
    wrap.innerHTML =
      '<div class="copy-fallback-card">' +
        '<p class="copy-fallback-note">This browser blocked the clipboard. ' +
        'The text is selected — press <kbd>Ctrl</kbd>/<kbd>⌘</kbd>+<kbd>C</kbd>, then <kbd>Esc</kbd>.</p>' +
        '<textarea readonly></textarea>' +
        '<button class="btn ghost">Close</button>' +
      '</div>';

    var ta = wrap.querySelector('textarea');
    ta.value = text;

    function close() { wrap.remove(); document.removeEventListener('keydown', onKey); }
    function onKey(e) { if (e.key === 'Escape') close(); }

    wrap.addEventListener('click', function (e) { if (e.target === wrap) close(); });
    wrap.querySelector('button').onclick = close;
    document.addEventListener('keydown', onKey);

    document.body.appendChild(wrap);
    ta.focus();
    ta.select();
    ta.setSelectionRange(0, ta.value.length);
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
      '<button class="icon-btn" id="dFav" aria-pressed="' + (isFav(p.id) ? 'true' : 'false') +
      '" title="Favourite">' + (isFav(p.id) ? '★' : '☆') + '</button></div>' +
      '<div class="d-meta"><span class="tag cat-tag">' + esc(p.category) + '</span>' +
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

  /* -------------------------- new-prompt helper ------------------------- */

  function slugify(s) {
    return s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'untitled';
  }

  function buildSnippet() {
    var title = $('#npTitle').value.trim();
    var category = $('#npCategory').value.trim() || 'General';
    var tags = $('#npTags').value.split(',').map(function (t) { return t.trim(); }).filter(Boolean);
    var desc = $('#npDesc').value.trim();
    var body = $('#npBody').value;

    var found = [], seen = {}, m, re = slotRe();
    while ((m = re.exec(body)) !== null) {
      if (isSlot(m[1]) && !seen[m[1]]) { seen[m[1]] = 1; found.push(m[1]); }
    }

    $('#npDetected').innerHTML = found.length
      ? '<span>Detected fields:</span>' + found.map(function (t) { return '<span class="tag">' + esc(t) + '</span>'; }).join('')
      : '<span>No fields detected — wrap fill-ins in [BRACKETS], uppercase.</span>';

    var q = function (s) { return "'" + String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'") + "'"; };
    var safeBody = body.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$\{/g, '\\${');

    return '{\n' +
      '  id: ' + q(slugify(title)) + ',\n' +
      '  title: ' + q(title) + ',\n' +
      '  category: ' + q(category) + ',\n' +
      '  tags: [' + tags.map(q).join(', ') + '],\n' +
      '  description: ' + q(desc) + ',\n' +
      (found.length
        ? '  fields: {\n' + found.map(function (t) {
            return '    ' + q(t) + ': { label: ' + q(titleCase(t)) + ', type: ' +
              (t.length > 14 ? "'textarea'" : "'text'") + ' }';
          }).join(',\n') + '\n  },\n'
        : '') +
      '  body: `' + safeBody + '`\n' +
      '},';
  }

  function refreshSnippet() { $('#npOut').value = buildSnippet(); }

  function openModal(prompt) {
    $('#modalTitle').textContent = prompt ? 'Duplicate / edit prompt' : 'Add a prompt';
    $('#npTitle').value = prompt ? prompt.title : '';
    $('#npCategory').value = prompt ? prompt.category : '';
    $('#npTags').value = prompt ? (prompt.tags || []).join(', ') : '';
    $('#npDesc').value = prompt ? (prompt.description || '') : '';
    $('#npBody').value = prompt ? prompt.body : '';
    refreshSnippet();
    $('#modal').hidden = false;
    $('#npTitle').focus();
  }
  function closeModal() { $('#modal').hidden = true; }

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
    $('#newBtn').onclick = function () { openModal(null); };

    $('#modal').addEventListener('click', function (e) {
      if (e.target.getAttribute('data-close')) closeModal();
    });
    ['npTitle', 'npCategory', 'npTags', 'npDesc', 'npBody'].forEach(function (id) {
      document.getElementById(id).addEventListener('input', refreshSnippet);
    });
    $('#npCopy').onclick = function (e) {
      refreshSnippet();
      doCopy($('#npOut').value, e.currentTarget, null);
    };

    window.addEventListener('hashchange', fromHash);

    document.addEventListener('keydown', function (e) {
      // the manual-copy escape owns the keyboard while it is open
      if (document.getElementById('copyFallback')) return;

      var typing = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName);

      if (e.key === '/' && !typing) { e.preventDefault(); searchEl.focus(); searchEl.select(); return; }

      if (e.key === 'Escape') {
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
    applyTheme();
    wire();
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
