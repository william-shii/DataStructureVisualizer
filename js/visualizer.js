// ============================================================
// visualizer.js
// Shared code used by all three tabs:
//   1. NodeStore: the data (nodes and the variables that point at them)
//   2. Renderer:  draws the nodes and arrows on the page
//   3. Viz:       ties a NodeStore, a Renderer and the side panels together
//   4. Player:    controls the speed, and the "one line at a time" mode
// ============================================================

// Sizes in pixels. NODE_W, NODE_H and SLOT_W must match .box and .slot in style.css.
const NODE_W = 96;
const NODE_H = 48;
const SLOT_W = 30;      // the "next" part on the right of each node
const H_GAP = 64;       // space between nodes in a row (room for the arrow)
const V_GAP = 56;       // space between nodes in the stack's column
const ROW_GAP = 120;    // space between the main row and the "not linked in yet" row
const PAD = 28;         // empty space around the drawing
const TAG_SPACE = 130;  // room on the left for labels in the stack view
const SIDE_GAP = 150;   // how far right the stack's "not linked in" column sits
const MAX_NODES = 8;    // keep the drawing readable

const SVG_NS = 'http://www.w3.org/2000/svg';

// Wait for ms milliseconds. Used with await to slow the animation down.
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}


// ============================================================
// 1. NodeStore: the data model
//
// Each node is { id, value, next }, where next is the id of the next
// node, or null. This is exactly a LinearNode: data plus a next link.
//
// vars maps a variable name (front, current, ...) to the node id it
// points at, or null. "Instance" variables (like front) last forever;
// "local" variables (like current) disappear when the method ends.
// ============================================================
class NodeStore {
  constructor(headVar, instanceVars, hasCount) {
    this.nodes = new Map();          // id -> { id, value, next }
    this.vars = {};                  // node variables: name -> id or null
    this.ints = {};                  // number instance variables, like count
    this.locals = {};                // number local variables, like result
    this.headVar = headVar;          // the drawing starts from this variable
    this.instanceVars = instanceVars;
    this.hasCount = hasCount;
    this.nextId = 1;
    this.clear();
  }

  // Empty everything out.
  clear() {
    this.nodes.clear();
    this.vars = {};
    for (const name of this.instanceVars) {
      this.vars[name] = null;
    }
    this.ints = this.hasCount ? { count: 0 } : {};
    this.locals = {};
  }

  // Like "new LinearNode<T>(value)": a new node whose next starts as null.
  create(value) {
    const id = this.nextId++;
    this.nodes.set(id, { id: id, value: value, next: null });
    return id;
  }

  get(id) {
    return id == null ? null : this.nodes.get(id);
  }

  // The value stored in a node, or the word "null".
  valueOf(id) {
    return id == null ? 'null' : this.nodes.get(id).value;
  }

  // The ids you reach by starting at the head variable and following next.
  chain() {
    const ids = [];
    const seen = new Set();
    let id = this.vars[this.headVar];
    while (id != null && !seen.has(id)) {
      ids.push(id);
      seen.add(id);
      id = this.nodes.get(id).next;
    }
    return ids;
  }

  size() {
    return this.chain().length;
  }

  // Every node that some variable can still reach by following next links.
  reachableIds() {
    const reachable = new Set();
    for (const name of Object.keys(this.vars)) {
      let id = this.vars[name];
      while (id != null && !reachable.has(id)) {
        reachable.add(id);
        id = this.nodes.get(id).next;
      }
    }
    return reachable;
  }

  // The method has returned, so its local variables no longer exist.
  endScope() {
    for (const name of Object.keys(this.vars)) {
      if (!this.instanceVars.includes(name)) {
        delete this.vars[name];
      }
    }
    this.locals = {};
  }

  // Java's garbage collector: delete nodes nothing can reach any more.
  // Returns how many were deleted.
  collectGarbage() {
    const reachable = this.reachableIds();
    let removed = 0;
    for (const id of [...this.nodes.keys()]) {
      if (!reachable.has(id)) {
        this.nodes.delete(id);
        removed++;
      }
    }
    return removed;
  }

  // Build a chain from a list of values, without animation. Used for the
  // starting data. lastVar (optional) is set to the last node, e.g. "rear".
  build(values, lastVar) {
    this.clear();
    let first = null;
    let previous = null;
    for (const value of values) {
      const id = this.create(value);
      if (previous == null) {
        first = id;
      } else {
        this.get(previous).next = id;
      }
      previous = id;
    }
    this.vars[this.headVar] = first;
    if (lastVar) {
      this.vars[lastVar] = previous;
    }
    if (this.hasCount) {
      this.ints.count = values.length;
    }
  }
}


// ============================================================
// 2. Renderer: draws a NodeStore inside a "stage" element.
//
// Nodes are absolutely positioned divs. When a node's position changes,
// CSS animates it (see the transition on .node). Arrows are SVG paths
// that get redrawn every frame while nodes are moving.
// ============================================================
class Renderer {
  constructor(stage, orientation) {
    this.stage = stage;
    this.orientation = orientation;   // "horizontal" (list, queue) or "vertical" (stack)
    this.nodeEls = new Map();         // node id -> div
    this.nullEls = new Map();         // node id -> the "null" box after that node
    this.links = [];                  // arrows to draw this frame
    this.animUntil = 0;

    // The SVG layer for arrows, with an arrowhead shape we can reuse.
    const markerId = 'arrowhead-' + stage.id;
    this.svg = document.createElementNS(SVG_NS, 'svg');
    this.svg.setAttribute('class', 'arrows');
    this.svg.innerHTML =
      '<defs><marker id="' + markerId + '" viewBox="0 0 10 10" refX="9" refY="5" ' +
      'markerWidth="7" markerHeight="7" orient="auto"><path d="M0,0 L10,5 L0,10 z"/></marker></defs>';
    this.paths = document.createElementNS(SVG_NS, 'g');
    this.svg.appendChild(this.paths);
    this.markerUrl = 'url(#' + markerId + ')';
    stage.appendChild(this.svg);

    // Message shown when there are no nodes at all.
    this.emptyEl = document.createElement('div');
    this.emptyEl.className = 'empty-note';
    stage.appendChild(this.emptyEl);
  }

  // Work out where every node should go. Returns a Map: id -> { x, y }.
  // Nodes in the main chain go in a row (or column). Nodes that aren't
  // linked in (a brand-new node, or one being removed) go in a second row,
  // placed near the node they point to.
  layout(store) {
    const positions = new Map();
    const chain = store.chain();
    const horizontal = this.orientation === 'horizontal';

    chain.forEach((id, i) => {
      if (horizontal) {
        positions.set(id, { x: PAD + i * (NODE_W + H_GAP), y: PAD });
      } else {
        positions.set(id, { x: PAD + TAG_SPACE, y: PAD + i * (NODE_H + V_GAP) });
      }
    });

    const inChain = new Set(chain);
    let extra = 0;   // spreads out the (rare) case of two loose nodes
    for (const node of store.nodes.values()) {
      if (inChain.has(node.id)) {
        continue;
      }
      const target = chain.indexOf(node.next);
      // Sit halfway before the node it points to, or after the end if it points to null.
      const slot = Math.max(0, (target >= 0 ? target - 0.5 : chain.length) + extra);
      if (horizontal) {
        positions.set(node.id, { x: PAD + slot * (NODE_W + H_GAP), y: PAD + NODE_H + ROW_GAP });
      } else {
        positions.set(node.id, { x: PAD + TAG_SPACE + NODE_W + SIDE_GAP, y: PAD + slot * (NODE_H + V_GAP) });
      }
      extra++;
    }
    return positions;
  }

  // Where the little "null" box goes for a node whose next is null.
  nullPosition(p) {
    if (this.orientation === 'horizontal') {
      return { x: p.x + NODE_W + 30, y: p.y + NODE_H / 2 - 12 };
    }
    return { x: p.x + NODE_W - SLOT_W / 2 - 20, y: p.y + NODE_H + 28 };
  }

  createNodeEl() {
    const el = document.createElement('div');
    el.className = 'node';
    el.innerHTML = '<div class="box"><span class="data"></span><span class="slot"></span></div><div class="tags"></div>';
    return el;
  }

  // Draw the store. marks maps a node id to a CSS class: "new", "found" or "removed".
  render(store, marks) {
    marks = marks || {};
    const positions = this.layout(store);
    const live = store.reachableIds();

    // Which variable labels go on which node.
    const tagsById = new Map();
    for (const name of Object.keys(store.vars)) {
      const id = store.vars[name];
      if (id == null) {
        continue;
      }
      if (!tagsById.has(id)) {
        tagsById.set(id, []);
      }
      tagsById.get(id).push(name);
    }

    // Remove drawings of nodes that no longer exist.
    for (const [id, el] of this.nodeEls) {
      if (!store.nodes.has(id)) {
        el.remove();
        this.nodeEls.delete(id);
      }
    }
    for (const [id, el] of this.nullEls) {
      const node = store.get(id);
      if (!node || node.next != null) {
        el.remove();
        this.nullEls.delete(id);
      }
    }

    this.links = [];
    let maxX = PAD;
    let maxY = PAD;

    for (const node of store.nodes.values()) {
      const p = positions.get(node.id);
      let el = this.nodeEls.get(node.id);
      if (!el) {
        el = this.createNodeEl();
        this.stage.appendChild(el);
        this.nodeEls.set(node.id, el);
      }
      el.style.left = p.x + 'px';
      el.style.top = p.y + 'px';
      el.querySelector('.data').textContent = node.value;

      const classes = ['node'];
      if (marks[node.id]) {
        classes.push(marks[node.id]);
      }
      if (!live.has(node.id)) {
        classes.push('gone');
      }
      el.className = classes.join(' ');

      const tagBox = el.querySelector('.tags');
      tagBox.innerHTML = '';
      for (const name of tagsById.get(node.id) || []) {
        const tag = document.createElement('span');
        tag.className = 'tag tag-' + name;
        tag.textContent = name;
        tagBox.appendChild(tag);
      }

      if (node.next == null) {
        // Draw a "null" box and an arrow to it.
        let nullEl = this.nullEls.get(node.id);
        const np = this.nullPosition(p);
        if (!nullEl) {
          nullEl = document.createElement('div');
          nullEl.className = 'null-marker';
          nullEl.textContent = 'null';
          this.stage.appendChild(nullEl);
          this.nullEls.set(node.id, nullEl);
        }
        nullEl.style.left = np.x + 'px';
        nullEl.style.top = np.y + 'px';
        this.links.push({ fromId: node.id, nullOf: node.id });
      } else {
        this.links.push({ fromId: node.id, toId: node.next });
      }

      maxX = Math.max(maxX, p.x);
      maxY = Math.max(maxY, p.y);
    }

    // Empty structure message, like "front = null (empty)".
    if (store.nodes.size === 0) {
      this.emptyEl.textContent = store.headVar + ' = null   (empty)';
      this.emptyEl.hidden = false;
    } else {
      this.emptyEl.hidden = true;
    }

    // Make the stage big enough for everything; the wrapper scrolls if needed.
    let width;
    let height;
    if (this.orientation === 'horizontal') {
      width = maxX + NODE_W + 110 + PAD;
      height = PAD + NODE_H + ROW_GAP + NODE_H + 90;
    } else {
      width = PAD + TAG_SPACE + NODE_W + SIDE_GAP + NODE_W + PAD;
      height = Math.max(300, maxY + NODE_H + V_GAP + 40 + PAD);
    }
    this.stage.style.width = width + 'px';
    this.stage.style.height = height + 'px';
    this.svg.setAttribute('width', width);
    this.svg.setAttribute('height', height);

    this.animateArrows();
  }

  // Keep redrawing arrows while the nodes slide to their new spots.
  animateArrows() {
    const alreadyRunning = performance.now() < this.animUntil;
    this.animUntil = performance.now() + 600;
    if (alreadyRunning) {
      return;
    }
    const tick = () => {
      this.drawArrows();
      if (performance.now() < this.animUntil) {
        requestAnimationFrame(tick);
      }
    };
    requestAnimationFrame(tick);
  }

  // Draw one arrow per node, from its "next" slot to whatever it points at.
  drawArrows() {
    const base = this.stage.getBoundingClientRect();
    const rect = el => {
      const r = el.getBoundingClientRect();
      return { l: r.left - base.left, t: r.top - base.top, r: r.right - base.left, b: r.bottom - base.top, w: r.width, h: r.height };
    };

    this.paths.innerHTML = '';
    for (const link of this.links) {
      const fromEl = this.nodeEls.get(link.fromId);
      const toEl = link.nullOf != null ? this.nullEls.get(link.nullOf) : this.nodeEls.get(link.toId);
      if (!fromEl || !toEl) {
        continue;
      }
      const a = rect(fromEl.querySelector('.box'));
      const b = rect(toEl.querySelector('.box') || toEl);
      const sx = a.r - SLOT_W / 2;   // centre of the "next" slot
      const sy = a.t + a.h / 2;
      let d;

      if (this.orientation === 'horizontal') {
        const by = b.t + b.h / 2;
        if (Math.abs(by - sy) < 6) {
          // Same row: straight arrow to the left side of the target.
          d = 'M ' + sx + ' ' + sy + ' L ' + (b.l - 3) + ' ' + sy;
        } else if (by < sy) {
          // Target is above: curve up into its bottom, to the right of any
          // labels (like front) hanging under it, so the arrowhead isn't hidden.
          const tags = toEl.querySelector('.tags');
          const tagsRight = tags && tags.children.length ? rect(tags).r : b.l;
          const ex = Math.min(Math.max(b.l + 28, tagsRight + 10), b.r - 8);
          const ey = b.b + 3;
          d = 'M ' + sx + ' ' + sy + ' C ' + (sx + 50) + ' ' + sy + ', ' + ex + ' ' + (ey + 60) + ', ' + ex + ' ' + ey;
        } else {
          // Target is below: curve down into its top.
          const ex = b.l + Math.min(28, b.w / 2);
          const ey = b.t - 3;
          d = 'M ' + sx + ' ' + sy + ' C ' + (sx + 50) + ' ' + sy + ', ' + ex + ' ' + (ey - 60) + ', ' + ex + ' ' + ey;
        }
      } else {
        if (sx >= b.l - 6 && sx <= b.r + 6) {
          // Target is right below the "next" slot: straight down.
          d = 'M ' + sx + ' ' + a.b + ' L ' + sx + ' ' + (b.t - 3);
        } else {
          // From the side column back to a node in the main column.
          const ex = b.r + 3;
          const ey = b.t + b.h / 2;
          d = 'M ' + sx + ' ' + a.b + ' C ' + sx + ' ' + (a.b + 40) + ', ' + (ex + 60) + ' ' + ey + ', ' + ex + ' ' + ey;
        }
      }

      const path = document.createElementNS(SVG_NS, 'path');
      path.setAttribute('d', d);
      path.setAttribute('class', 'arrow');
      path.setAttribute('marker-end', this.markerUrl);
      this.paths.appendChild(path);
    }
  }
}


// ============================================================
// 3. Viz: one per tab. Connects the data, the drawing, the code
//    panel, the variables panel and the explanation text.
// ============================================================
class Viz {
  constructor(prefix, store, orientation) {
    this.store = store;
    this.renderer = new Renderer(document.getElementById(prefix + '-stage'), orientation);
    this.codeEl = document.getElementById(prefix + '-code');
    this.codeTitleEl = document.getElementById(prefix + '-code-title');
    this.msgEl = document.getElementById(prefix + '-msg');
    this.varsEl = document.getElementById(prefix + '-vars');
    this.resultEl = document.getElementById(prefix + '-result');
    this.codeLines = [];
  }

  // Show a Java method in the code panel. spec = { title, lines }.
  setCode(spec) {
    this.codeTitleEl.textContent = spec.title;
    this.codeEl.innerHTML = '';
    for (const line of spec.lines) {
      const li = document.createElement('li');
      li.textContent = line;
      this.codeEl.appendChild(li);
    }
    this.codeLines = Array.from(this.codeEl.children);
  }

  // Redraw everything. line is the code line to highlight (-1 for none).
  show(line, message, marks) {
    this.renderer.render(this.store, marks);
    this.codeLines.forEach((li, i) => li.classList.toggle('active', i === line));
    if (message != null) {
      this.msgEl.textContent = message;
    }
    this.renderVars();
  }

  renderVars() {
    const s = this.store;
    this.varsEl.innerHTML = '';
    const add = (name, value, kind) => {
      const li = document.createElement('li');
      li.innerHTML = '<span class="name"></span><span class="value"></span><span class="kind"></span>';
      li.querySelector('.name').textContent = name;
      li.querySelector('.value').textContent = value;
      li.querySelector('.kind').textContent = kind;
      this.varsEl.appendChild(li);
    };
    for (const name of Object.keys(s.vars)) {
      const id = s.vars[name];
      const kind = s.instanceVars.includes(name) ? 'instance' : 'local';
      add(name, id == null ? 'null' : '→ node ' + s.valueOf(id), kind);
    }
    for (const name of Object.keys(s.ints)) {
      add(name, String(s.ints[name]), 'instance');
    }
    for (const name of Object.keys(s.locals)) {
      add(name, String(s.locals[name]), 'local');
    }
  }

  // Show one step, then wait (for the timer, or for the Next button).
  async step(line, message, marks) {
    this.show(line, message, marks || {});
    await Player.wait();
  }

  // The method is over: drop local variables, run the garbage collector,
  // and show the outcome. kind is "ok", "warn" or "error".
  finish(resultText, kind) {
    this.store.endScope();
    const removed = this.store.collectGarbage();
    let message = 'Done. Local variables disappear when the method returns.';
    if (removed > 0) {
      message += ' Nothing points to the removed node any more, so Java\'s garbage collector frees it.';
    }
    this.show(-1, message, {});
    this.setResult(resultText, kind || 'ok');
  }

  setResult(text, kind) {
    this.resultEl.textContent = text;
    this.resultEl.className = 'result ' + (kind || '');
  }

  // Read a whole number from an input box, or show a warning and return null.
  readNumber(input) {
    const text = input.value.trim();
    if (!/^-?\d{1,3}$/.test(text)) {
      this.setResult('Type a whole number from -999 to 999 first.', 'warn');
      input.focus();
      return null;
    }
    return Number(text);
  }

  // Stop the drawing getting too big.
  hasRoom() {
    if (this.store.size() >= MAX_NODES) {
      this.setResult('That\'s ' + MAX_NODES + ' nodes, the most this page shows. Remove one first.', 'warn');
      return false;
    }
    return true;
  }
}


// ============================================================
// 4. Player: how long each step waits, and the step-through mode.
// ============================================================
const SPEEDS = [1700, 1150, 800, 480, 220];   // milliseconds per step, slowest to fastest

const Player = {
  delay: SPEEDS[2],
  stepMode: false,
  resume: null,        // set while we're waiting for the Next button
  nextButton: null,
  busy: false,

  wait() {
    if (this.stepMode) {
      return new Promise(resolve => {
        this.resume = resolve;
        if (this.nextButton) {
          this.nextButton.disabled = false;
          this.nextButton.focus();
        }
      });
    }
    return sleep(this.delay);
  },

  next() {
    if (this.resume) {
      const resume = this.resume;
      this.resume = null;
      if (this.nextButton) {
        this.nextButton.disabled = true;
      }
      resume();
    }
  },

  // Run one operation at a time, and lock the buttons while it plays.
  async run(operation) {
    if (this.busy) {
      return;
    }
    this.busy = true;
    document.querySelectorAll('button.op, .tab').forEach(b => { b.disabled = true; });
    try {
      await operation();
    } catch (err) {
      console.error(err);
    } finally {
      this.busy = false;
      document.querySelectorAll('button.op, .tab').forEach(b => { b.disabled = false; });
    }
  }
};

// A random value to suggest next, so the user doesn't have to type every time.
function randomValue() {
  return String(1 + Math.floor(Math.random() * 99));
}
