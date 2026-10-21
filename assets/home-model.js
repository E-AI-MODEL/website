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
