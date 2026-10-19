// ============================================================
// queue.js: a queue built from linked nodes.
//
// front is where items leave; rear is where they join.
// First in, first out, like a line at a store.
// ============================================================

const QUEUE_CODE = {
  enqueue: {
    title: 'void enqueue(T element)',
    lines: [
      'LinearNode<T> newNode = new LinearNode<T>(element);',
      'if (isEmpty()) {',
      '    front = newNode;',
      '} else {',
      '    rear.setNext(newNode);',
      '}',
      'rear = newNode;',
      'count++;'
    ]
  },
  dequeue: {
    title: 'T dequeue() throws EmptyCollectionException',
    lines: [
      'if (isEmpty()) {',
      '    throw new EmptyCollectionException("queue");',
      '}',
      'T result = front.getData();',
      'front = front.getNext();',
      'count--;',
      'if (isEmpty()) {',
      '    rear = null;',
      '}',
      'return result;'
    ]
  }
};


async function queueEnqueue(viz, value) {
  const s = viz.store;
  viz.setCode(QUEUE_CODE.enqueue);

  const n = s.create(value);
  s.vars.newNode = n;
  await viz.step(0, 'Create a new node holding ' + value + '. It will join at the rear.', { [n]: 'new' });

  if (s.ints.count === 0) {
    await viz.step(1, 'isEmpty() is true: the queue is empty.', { [n]: 'new' });
    s.vars.front = n;
    await viz.step(2, 'front points to the new node, since it\'s the only one.', { [n]: 'new' });
  } else {
    await viz.step(1, 'isEmpty() is false.', { [n]: 'new' });
    s.get(s.vars.rear).next = n;
    await viz.step(4, 'The current rear (' + s.valueOf(s.vars.rear) + ') now points to the new node.', { [n]: 'new' });
  }

  s.vars.rear = n;
  await viz.step(6, 'Move rear to the new node. ' + value + ' is now last in line.', { [n]: 'new' });

  s.ints.count++;
  await viz.step(7, 'count goes up to ' + s.ints.count + '.', { [n]: 'new' });

  viz.finish('Enqueued ' + value + '.');
}


async function queueDequeue(viz) {
  const s = viz.store;
  viz.setCode(QUEUE_CODE.dequeue);

  if (s.ints.count === 0) {
    await viz.step(0, 'isEmpty() is true: count is 0.');
    await viz.step(1, 'There\'s nobody in line, so the method throws an exception and ends immediately.');
    viz.finish('EmptyCollectionException: the queue is empty.', 'error');
    return;
  }
  await viz.step(0, 'isEmpty() is false, so there is something to dequeue.');

  const oldFront = s.vars.front;
  s.locals.result = s.get(oldFront).value;
  await viz.step(3, 'Save the front value (' + s.locals.result + ') in result.', { [oldFront]: 'found' });

  s.vars.front = s.get(oldFront).next;
  await viz.step(4, s.vars.front == null
    ? 'Move front to the next node, which is null. rear still points at the old node, though.'
    : 'Move front to the next node (' + s.valueOf(s.vars.front) + ').',
    { [oldFront]: 'removed' });

  s.ints.count--;
  await viz.step(5, 'count goes down to ' + s.ints.count + '.', { [oldFront]: 'removed' });

  if (s.ints.count === 0) {
    await viz.step(6, 'isEmpty() is true now: that was the last item.', { [oldFront]: 'removed' });
    s.vars.rear = null;
    await viz.step(7, 'Set rear to null too. Otherwise rear would still point at a node that\'s no longer in the queue.', { [oldFront]: 'removed' });
  } else {
    await viz.step(6, 'isEmpty() is false, so rear stays where it is.', { [oldFront]: 'removed' });
  }

  const result = s.locals.result;
  await viz.step(9, 'Return ' + result + '.', { [oldFront]: 'removed' });
  viz.finish('dequeue() returned ' + result + '.');
}


function setupQueue() {
  const store = new NodeStore('front', ['front', 'rear'], true);
  const viz = new Viz('qu', store, 'horizontal');
  const valueInput = document.getElementById('qu-value');

  const reset = () => {
    store.build([2, 7, 4], 'rear');
    viz.setCode(QUEUE_CODE.enqueue);
    viz.show(-1, 'A queue: 2 is at the front, 4 is at the rear. Enqueue joins at the rear; dequeue leaves from the front.', {});
    viz.setResult('', '');
  };

  document.getElementById('qu-enqueue').addEventListener('click', () => {
    const value = viz.readNumber(valueInput);
    if (value == null || !viz.hasRoom()) return;
    Player.run(async () => { await queueEnqueue(viz, value); valueInput.value = randomValue(); });
  });
  document.getElementById('qu-dequeue').addEventListener('click', () => Player.run(() => queueDequeue(viz)));
  document.getElementById('qu-reset').addEventListener('click', reset);

  reset();
  return viz;
}
