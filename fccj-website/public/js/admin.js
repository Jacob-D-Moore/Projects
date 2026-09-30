// Small progressive enhancements for the admin. Everything works without it.
(function () {
  'use strict';
  var csrf = (document.querySelector('meta[name="csrf-token"]') || {}).content || '';

  // Confirm before destructive actions (forms marked with data-confirm).
  document.addEventListener('submit', function (e) {
    var msg = e.target.getAttribute && e.target.getAttribute('data-confirm');
    if (msg && !window.confirm(msg)) e.preventDefault();
  });

  // Auto-fill "page address" fields from the title while they are empty.
  document.querySelectorAll('input[data-slug-from]').forEach(function (slug) {
    var src = document.querySelector('[name="' + slug.getAttribute('data-slug-from') + '"]');
    if (!src) return;
    var touched = slug.value !== '';
    slug.addEventListener('input', function () { touched = slug.value !== ''; });
    src.addEventListener('input', function () {
      if (touched) return;
      slug.value = src.value.toLowerCase().normalize('NFKD').replace(/[^\w\s-]/g, '').trim().replace(/[\s_]+/g, '-').replace(/-+/g, '-').slice(0, 80);
    });
  });

  // Click-to-select file links in the media library.
  document.querySelectorAll('input.copy').forEach(function (i) {
    i.addEventListener('focus', function () {
      i.select();
      if (navigator.clipboard) navigator.clipboard.writeText(location.origin + i.value).catch(function () {});
    });
  });

  // Markdown toolbar + live preview.
  document.querySelectorAll('.md-toolbar').forEach(function (bar) {
    var ta = document.getElementById(bar.getAttribute('data-for'));
    var preview = bar.parentNode.querySelector('.md-preview');
    if (!ta) return;

    function wrap(before, after, placeholder) {
      var s = ta.selectionStart, e = ta.selectionEnd;
      var sel = ta.value.slice(s, e) || placeholder;
      ta.setRangeText(before + sel + after, s, e, 'end');
      ta.focus();
      ta.setSelectionRange(s + before.length, s + before.length + sel.length);
    }
    function linePrefix(prefix) {
      var s = ta.selectionStart;
      var lineStart = ta.value.lastIndexOf('\n', s - 1) + 1;
      ta.setRangeText(prefix, lineStart, lineStart, 'end');
      ta.focus();
    }

    bar.addEventListener('click', function (ev) {
      var btn = ev.target.closest('button[data-md]');
      if (!btn) return;
      var kind = btn.getAttribute('data-md');
      if (kind === 'bold') wrap('**', '**', 'bold text');
      else if (kind === 'italic') wrap('*', '*', 'italic text');
      else if (kind === 'h2') linePrefix('## ');
      else if (kind === 'list') linePrefix('- ');
      else if (kind === 'link') {
        var url = window.prompt('Paste the link (starting with https://)', 'https://');
        if (url) wrap('[', '](' + url + ')', 'link text');
      } else if (kind === 'preview') {
        var showing = !preview.hidden;
        if (showing) { preview.hidden = true; ta.hidden = false; btn.setAttribute('aria-pressed', 'false'); btn.textContent = 'Preview'; return; }
        var body = new URLSearchParams({ md: ta.value, _csrf: csrf });
        fetch('/admin/preview', { method: 'POST', body: body, credentials: 'same-origin', headers: { 'X-CSRF-Token': csrf } })
          .then(function (r) { return r.ok ? r.text() : Promise.reject(r.status); })
          .then(function (html) {
            // Server-rendered with raw HTML escaped and URLs filtered.
            preview.innerHTML = html || '<p><em>Nothing to preview.</em></p>';
            preview.hidden = false; ta.hidden = true;
            btn.setAttribute('aria-pressed', 'true'); btn.textContent = 'Edit';
          })
          .catch(function () { window.alert('Preview is unavailable. Your session may have expired.'); });
      }
    });
  });

  // Warn before leaving a form with unsaved changes.
  document.querySelectorAll('form.form[enctype]').forEach(function (form) {
    var dirty = false;
    form.addEventListener('input', function () { dirty = true; });
    form.addEventListener('submit', function () { dirty = false; });
    window.addEventListener('beforeunload', function (e) { if (dirty) { e.preventDefault(); e.returnValue = ''; } });
  });
})();
