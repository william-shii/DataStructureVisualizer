// ============================================================
// linkedlist.js: the singly linked list tab.
//
// Each operation changes the data one Java line at a time, and calls
// viz.step(line, explanation, marks) after each change so it's drawn.
// ============================================================

const LL_CODE = {
  insertFront: {
    title: 'void insertFront(T value)',
    lines: [
      'LinearNode<T> newNode = new LinearNode<T>(value);',
      'newNode.setNext(front);',
      'front = newNode;'
    ]
  },
  insertEnd: {
    title: 'void insertEnd(T value)',
    lines: [
      'LinearNode<T> newNode = new LinearNode<T>(value);',
      'if (front == null) {',
      '    front = newNode;',
      '} else {',
      '    LinearNode<T> current = front;',
      '    while (current.getNext() != null) {',
      '        current = current.getNext();',
      '    }',
      '    current.setNext(newNode);',
      '}'
    ]
  },
  insertAfter: {
    title: 'boolean insertAfter(T target, T value)',
    lines: [
      'LinearNode<T> current = front;',
      'while (current != null && !current.getData().equals(target)) {',
      '    current = current.getNext();',
      '}',
      'if (current == null) {',
      '    return false;',
      '}',
      'LinearNode<T> newNode = new LinearNode<T>(value);',
      'newNode.setNext(current.getNext());',
      'current.setNext(newNode);',
      'return true;'
    ]
  },
  remove: {
    title: 'boolean remove(T target)',
    lines: [
      'LinearNode<T> current = front;',
      'LinearNode<T> predecessor = null;',
      'while (current != null && !current.getData().equals(target)) {',
      '    predecessor = current;',
      '    current = current.getNext();',
      '}',
      'if (current == null) {',
      '    return false;',
      '}',
      'if (predecessor != null) {',
      '    predecessor.setNext(current.getNext());',
      '} else {',
      '    front = front.getNext();',
      '}',
      'return true;'
    ]
  }
};


async function llInsertFront(viz, value) {
  const s = viz.store;
  viz.setCode(LL_CODE.insertFront);

  const n = s.create(value);
  s.vars.newNode = n;
  await viz.step(0, 'Create a new node holding ' + value + '. A new node\'s next starts as null.', { [n]: 'new' });

  s.get(n).next = s.vars.front;
  await viz.step(1, s.vars.front == null
    ? 'front is null (the list is empty), so the new node keeps pointing at null.'
    : 'Point the new node at the current first node (' + s.valueOf(s.vars.front) + '). Do this BEFORE moving front, or the rest of the list is lost.',
    { [n]: 'new' });

  s.vars.front = n;
  await viz.step(2, 'Move front to the new node. ' + value + ' is now first.', { [n]: 'new' });

  viz.finish('Inserted ' + value + ' at the front.');
}


async function llInsertEnd(viz, value) {
  const s = viz.store;
  viz.setCode(LL_CODE.insertEnd);

  const n = s.create(value);
  s.vars.newNode = n;
  await viz.step(0, 'Create a new node holding ' + value + '. Its next is null, which is right, because it will be last.', { [n]: 'new' });

  if (s.vars.front == null) {
    await viz.step(1, 'front is null, so the list is empty.', { [n]: 'new' });
    s.vars.front = n;
    await viz.step(2, 'The new node becomes the whole list: front points to it.', { [n]: 'new' });
  } else {
    await viz.step(1, 'front isn\'t null, so we need to walk to the last node.', { [n]: 'new' });
    s.vars.current = s.vars.front;
    await viz.step(4, 'current starts at the first node (' + s.valueOf(s.vars.current) + ').', { [n]: 'new' });

    while (true) {
      const after = s.get(s.vars.current).next;
      if (after == null) {
        await viz.step(5, 'current.getNext() is null, so current is on the last node. Stop.', { [n]: 'new' });
        break;
      }
      await viz.step(5, 'current.getNext() is ' + s.valueOf(after) + ', not null, so keep going.', { [n]: 'new' });
      s.vars.current = after;
      await viz.step(6, 'Move current forward to ' + s.valueOf(after) + '.', { [n]: 'new' });
    }

    s.get(s.vars.current).next = n;
    await viz.step(8, 'The last node (' + s.valueOf(s.vars.current) + ') now points to the new node.', { [n]: 'new' });
  }

  viz.finish('Inserted ' + value + ' at the end.');
}


async function llInsertAfter(viz, target, value) {
  const s = viz.store;
  viz.setCode(LL_CODE.insertAfter);

  s.vars.current = s.vars.front;
  await viz.step(0, s.vars.current == null
    ? 'current starts at front, which is null: the list is empty.'
    : 'current starts at the first node (' + s.valueOf(s.vars.current) + '). We\'re looking for ' + target + '.');

  while (true) {
    const cur = s.vars.current;
    if (cur == null) {
      await viz.step(1, 'current is null: we walked off the end without finding ' + target + '.');
      break;
    }
    if (s.get(cur).value === target) {
      await viz.step(1, 'current is on ' + target + '. Found it, so the loop stops.', { [cur]: 'found' });
      break;
    }
    await viz.step(1, 'current is on ' + s.valueOf(cur) + ', not ' + target + ', so keep walking.');
    s.vars.current = s.get(cur).next;
    await viz.step(2, s.vars.current == null ? 'current moves forward to null.' : 'current moves forward to ' + s.valueOf(s.vars.current) + '.');
  }

  if (s.vars.current == null) {
    await viz.step(4, 'current is null, so ' + target + ' isn\'t in the list.');
    await viz.step(5, 'Return false.');
    viz.finish(target + ' isn\'t in the list, so nothing was inserted.', 'warn');
    return;
  }

  const cur = s.vars.current;
  await viz.step(4, 'current isn\'t null, so we found ' + target + '.', { [cur]: 'found' });

  const n = s.create(value);
  s.vars.newNode = n;
  await viz.step(7, 'Create a new node holding ' + value + '.', { [cur]: 'found', [n]: 'new' });

  s.get(n).next = s.get(cur).next;
  await viz.step(8, 'Point the new node at whatever comes after ' + target + ' (' + s.valueOf(s.get(n).next) + '). Do this first, or that part of the list is lost.', { [cur]: 'found', [n]: 'new' });

  s.get(cur).next = n;
  await viz.step(9, target + ' now points to the new node, so ' + value + ' is linked in.', { [cur]: 'found', [n]: 'new' });

  await viz.step(10, 'Return true.', { [n]: 'new' });
  viz.finish('Inserted ' + value + ' after ' + target + '.');
}


async function llRemove(viz, target) {
  const s = viz.store;
  viz.setCode(LL_CODE.remove);

  s.vars.current = s.vars.front;
  await viz.step(0, s.vars.current == null
    ? 'current starts at front, which is null: the list is empty.'
    : 'current starts at the first node (' + s.valueOf(s.vars.current) + '). We\'re looking for ' + target + '.');

  s.vars.predecessor = null;
  await viz.step(1, 'predecessor starts as null, because nothing comes before the first node.');

  while (true) {
    const cur = s.vars.current;
    if (cur == null) {
      await viz.step(2, 'current is null: we walked off the end without finding ' + target + '.');
      break;
    }
    if (s.get(cur).value === target) {
      await viz.step(2, 'current is on ' + target + '. Found it, so the loop stops.', { [cur]: 'found' });
      break;
    }
    await viz.step(2, 'current is on ' + s.valueOf(cur) + ', not ' + target + ', so keep walking.');
    s.vars.predecessor = cur;
    await viz.step(3, 'predecessor steps onto ' + s.valueOf(cur) + ', where current is. It always stays one node behind.');
    s.vars.current = s.get(cur).next;
    await viz.step(4, s.vars.current == null ? 'current moves forward to null.' : 'current moves forward to ' + s.valueOf(s.vars.current) + '.');
  }

  if (s.vars.current == null) {
    await viz.step(6, 'current is null, so ' + target + ' isn\'t in the list.');
    await viz.step(7, 'Return false.');
    viz.finish(target + ' isn\'t in the list, so nothing was removed.', 'warn');
    return;
  }

  const cur = s.vars.current;
  await viz.step(6, 'current isn\'t null, so we found the node to remove.', { [cur]: 'found' });

  if (s.vars.predecessor != null) {
    const pred = s.vars.predecessor;
    await viz.step(9, 'predecessor is on ' + s.valueOf(pred) + ', so ' + target + ' isn\'t the first node.', { [cur]: 'found' });
    s.get(pred).next = s.get(cur).next;
    await viz.step(10, s.valueOf(pred) + ' now skips over ' + target + ' and points to ' + s.valueOf(s.get(pred).next) + '.', { [cur]: 'removed' });
  } else {
    await viz.step(9, 'predecessor is null, so ' + target + ' is the first node.', { [cur]: 'found' });
    s.vars.front = s.get(s.vars.front).next;
    await viz.step(12, 'front moves to the next node (' + s.valueOf(s.vars.front) + '), skipping over ' + target + '.', { [cur]: 'removed' });
  }

  await viz.step(14, 'Return true.', { [cur]: 'removed' });
  viz.finish('Removed ' + target + '.');
}


function setupLinkedList() {
  const store = new NodeStore('front', ['front'], false);
  const viz = new Viz('ll', store, 'horizontal');
  const valueInput = document.getElementById('ll-value');
  const afterInput = document.getElementById('ll-after');

  const reset = () => {
    store.build([4, 8, 5]);
    viz.setCode(LL_CODE.remove);
    viz.show(-1, 'This list holds 4 → 8 → 5. Pick an operation above to watch it run.', {});
    viz.setResult('', '');
  };

  document.getElementById('ll-insert-front').addEventListener('click', () => {
    const value = viz.readNumber(valueInput);
    if (value == null || !viz.hasRoom()) return;
    Player.run(async () => { await llInsertFront(viz, value); valueInput.value = randomValue(); });
  });

  document.getElementById('ll-insert-end').addEventListener('click', () => {
    const value = viz.readNumber(valueInput);
    if (value == null || !viz.hasRoom()) return;
    Player.run(async () => { await llInsertEnd(viz, value); valueInput.value = randomValue(); });
  });

  document.getElementById('ll-insert-after').addEventListener('click', () => {
    const value = viz.readNumber(valueInput);
    if (value == null) return;
    const target = viz.readNumber(afterInput);
    if (target == null || !viz.hasRoom()) return;
    Player.run(async () => { await llInsertAfter(viz, target, value); valueInput.value = randomValue(); });
  });

  document.getElementById('ll-remove').addEventListener('click', () => {
    const value = viz.readNumber(valueInput);
    if (value == null) return;
    Player.run(() => llRemove(viz, value));
  });

  document.getElementById('ll-reset').addEventListener('click', reset);

  reset();
  return viz;
}
