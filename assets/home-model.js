/* Progressive enhancement: without JS the three moments remain native details. */
(function () {
  'use strict';
  document.querySelectorAll('[data-hm-cases]').forEach(function (root, instance) {
    if (root.dataset.enhanced) return;
    var sources = Array.from(root.querySelectorAll('.hm-case-source'));
    var controls = root.querySelector('.hm-case-controls');
    var output = root.querySelector('.hm-case-output');
    if (!sources.length || !controls || !output || sources.some(function (s) { return !s.querySelector('article') || !s.querySelector('summary'); })) return;
    var buttons = sources.map(function (source, index) {
      var button = document.createElement('button');
      button.type = 'button';
      button.id = 'hm-moment-' + instance + '-' + index;
      button.setAttribute('role', 'tab');
      button.setAttribute('aria-controls', output.id);
      button.setAttribute('data-eai-demo', String(index));
      button.textContent = source.querySelector('summary').textContent;
      controls.appendChild(button);
      return button;
    });
    function select(index, focus) {
      buttons.forEach(function (button, n) {
        button.setAttribute('aria-selected', String(n === index));
        button.setAttribute('aria-pressed', String(n === index));
        button.tabIndex = n === index ? 0 : -1;
      });
      output.replaceChildren(sources[index].querySelector('article').cloneNode(true));
      output.setAttribute('aria-labelledby', buttons[index].id);
      if (focus) buttons[index].focus();
    }
    buttons.forEach(function (button, index) {
      button.addEventListener('click', function () { select(index, false); });
      button.addEventListener('keydown', function (event) {
        var target = event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1 : event.key === 'ArrowRight' ? (index + 1) % buttons.length : event.key === 'ArrowLeft' ? (index + buttons.length - 1) % buttons.length : null;
        if (target !== null) { event.preventDefault(); select(target, true); }
      });
    });
    controls.setAttribute('role', 'tablist');
    controls.setAttribute('aria-label', document.documentElement.lang === 'en' ? 'Choose a learning stage' : 'Kies een moment in het leren');
    output.setAttribute('role', 'tabpanel');
    output.setAttribute('aria-live', 'polite');
    output.tabIndex = 0;
    select(0, false);
    sources.forEach(function (source) { source.hidden = true; });
    controls.hidden = false;
    output.hidden = false;
    root.dataset.enhanced = 'true';
  });
})();

/* School-wide examples. The full content remains in native details without JS. */
(function () {
  'use strict';
  document.querySelectorAll('[data-eh-explorer]').forEach(function (root, instance) {
    if (root.dataset.enhanced) return;
    var sources = Array.from(root.querySelectorAll('.eh-case-source'));
    var controls = root.querySelector('.eh-case-controls');
    var output = root.querySelector('.eh-case-output');
    if (!controls || !output || !sources.length || sources.some(function (s) { return !s.querySelector('summary') || !s.querySelector('article'); })) return;
    var sourceIds = sources.map(function (source) { return source.id; });
    var buttons = sources.map(function (source, index) {
      var button = document.createElement('button');
      button.type = 'button';
      button.className = 'eh-choice';
      button.id = 'eh-question-' + instance + '-' + index;
      button.setAttribute('role', 'tab');
      button.setAttribute('aria-controls', output.id);
      Array.from(source.querySelector('summary').children).forEach(function (child) { button.appendChild(child.cloneNode(true)); });
      controls.appendChild(button);
      return button;
    });
    function select(index, focus, updateHash) {
      buttons.forEach(function (button, n) {
        button.setAttribute('aria-selected', String(n === index));
        button.tabIndex = n === index ? 0 : -1;
      });
      var article = sources[index].querySelector('article').cloneNode(true);
      article.id = sourceIds[index];
      output.replaceChildren(article);
      output.setAttribute('aria-labelledby', buttons[index].id);
      root.dataset.activeCase = sourceIds[index];
      if (focus) buttons[index].focus();
      if (updateHash && window.history && window.history.replaceState) {
        try { window.history.replaceState(null, '', '#' + sourceIds[index]); } catch (_) { /* File previews may not allow history changes. */ }
      }
    }
    buttons.forEach(function (button, index) {
      button.addEventListener('click', function () { select(index, false, true); });
      button.addEventListener('keydown', function (event) {
        var target = event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1 : (event.key === 'ArrowDown' || event.key === 'ArrowRight') ? (index + 1) % buttons.length : (event.key === 'ArrowUp' || event.key === 'ArrowLeft') ? (index + buttons.length - 1) % buttons.length : null;
        if (target !== null) { event.preventDefault(); select(target, true, true); }
      });
    });
    function routeHash(scroll) {
      var hash = window.location.hash.slice(1);
      var index = sourceIds.indexOf(hash);
      if (index < 0) return false;
      select(index, false, false);
      if (scroll) document.getElementById('beginnen').scrollIntoView({ block: 'start' });
      return true;
    }
    controls.setAttribute('role', 'tablist');
    controls.setAttribute('aria-label', document.documentElement.lang === 'en' ? 'Choose your question about AI' : 'Kies je vraag over AI');
    output.setAttribute('role', 'tabpanel');
    output.tabIndex = 0;
    sources.forEach(function (source) { source.removeAttribute('id'); source.hidden = true; });
    controls.hidden = false;
    output.hidden = false;
    root.dataset.enhanced = 'true';
    if (!routeHash(true)) select(0, false, false);
    window.addEventListener('hashchange', function () { routeHash(true); });
    document.querySelectorAll('.eh-school-map a[href^="#"]').forEach(function (link) {
      link.addEventListener('click', function (event) {
        var id = link.getAttribute('href').slice(1);
        var index = sourceIds.indexOf(id);
        if (index < 0) return;
        event.preventDefault();
        select(index, true, true);
        document.getElementById('beginnen').scrollIntoView({ block: 'start' });
      });
    });
  });
})();
