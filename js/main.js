// ============================================================
// main.js: starts everything and wires up the tabs and player.
// ============================================================

document.addEventListener('DOMContentLoaded', () => {
  const vizByTab = {
    'linked-list': setupLinkedList(),
    'stack': setupStack(),
    'queue': setupQueue()
  };

  // ---------- tabs ----------
  const tabs = Array.from(document.querySelectorAll('.tab'));

  function showTab(name) {
    if (!vizByTab[name]) {
      name = 'linked-list';
    }
    for (const tab of tabs) {
      const selected = tab.dataset.tab === name;
      tab.setAttribute('aria-selected', String(selected));
      document.getElementById('panel-' + tab.dataset.tab).hidden = !selected;
    }
    // A hidden panel can't measure its nodes, so redraw the arrows once it's visible.
    vizByTab[name].renderer.render(vizByTab[name].store, {});
    // Put the tab in the address so the link can be shared, e.g. index.html#stack.
    // Some browsers block this for pages opened straight from a file, so ignore errors.
    try {
      if (location.hash !== '#' + name) {
        history.replaceState(null, '', '#' + name);
      }
    } catch (err) {
      // Not important: the page works the same without it.
    }
  }

  tabs.forEach((tab, i) => {
    tab.addEventListener('click', () => showTab(tab.dataset.tab));
    // Left and right arrow keys move between tabs.
    tab.addEventListener('keydown', e => {
      if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
        const next = tabs[(i + (e.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length];
        next.focus();
        showTab(next.dataset.tab);
      }
    });
  });

  // Open the tab named in the address, e.g. index.html#stack
  showTab(location.hash.slice(1));

  // ---------- player ----------
  const speed = document.getElementById('speed');
  const stepMode = document.getElementById('step-mode');
  const nextButton = document.getElementById('next-step');
  Player.nextButton = nextButton;

  speed.addEventListener('input', () => {
    Player.delay = SPEEDS[Number(speed.value) - 1];
  });

  stepMode.addEventListener('change', () => {
    Player.stepMode = stepMode.checked;
    if (!stepMode.checked) {
      Player.next();   // if we were paused, carry on automatically
    }
  });

  nextButton.addEventListener('click', () => Player.next());

  // Redraw arrows if the window size changes.
  window.addEventListener('resize', () => {
    for (const viz of Object.values(vizByTab)) {
      viz.renderer.drawArrows();
    }
  });
});
