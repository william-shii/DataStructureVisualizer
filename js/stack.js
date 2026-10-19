// ============================================================
// stack.js: a stack built from linked nodes.
//
// top is the only node you can reach directly. push adds a new node
// in front of top; pop removes top. Last in, first out.
// ============================================================

const STACK_CODE = {
  push: {
    title: 'void push(T element)',
    lines: [
      'LinearNode<T> newNode = new LinearNode<T>(element);',
      'newNode.setNext(top);',
      'top = newNode;',
      'count++;'
    ]
  },
  pop: {
    title: 'T pop() throws EmptyCollectionException',
    lines: [
      'if (isEmpty()) {',
      '    throw new EmptyCollectionException("stack");',
      '}',
      'T result = top.getData();',
      'top = top.getNext();',
      'count--;',
      'return result;'
    ]
  },
  peek: {
    title: 'T peek() throws EmptyCollectionException',
    lines: [
      'if (isEmpty()) {',
      '    throw new EmptyCollectionException("stack");',
      '}',
      'return top.getData();'
    ]
  }
};


async function stackPush(viz, value) {
  const s = viz.store;
  viz.setCode(STACK_CODE.push);

  const n = s.create(value);
  s.vars.newNode = n;
  await viz.step(0, 'Create a new node holding ' + value + '.', { [n]: 'new' });

  s.get(n).next = s.vars.top;
  await viz.step(1, s.vars.top == null
    ? 'top is null (the stack is empty), so the new node points at null.'
    : 'Point the new node at the current top (' + s.valueOf(s.vars.top) + ').',
    { [n]: 'new' });

  s.vars.top = n;
  await viz.step(2, 'Move top to the new node. ' + value + ' is now on top.', { [n]: 'new' });

  s.ints.count++;
  await viz.step(3, 'count goes up to ' + s.ints.count + '.', { [n]: 'new' });

  viz.finish('Pushed ' + value + '.');
}


async function stackPop(viz) {
  const s = viz.store;
  viz.setCode(STACK_CODE.pop);

  if (s.ints.count === 0) {
    await viz.step(0, 'isEmpty() is true: count is 0.');
    await viz.step(1, 'There\'s nothing to pop, so the method throws an exception and ends immediately.');
    viz.finish('EmptyCollectionException: the stack is empty.', 'error');
    return;
  }
  await viz.step(0, 'isEmpty() is false, so there is something to pop.');

  const oldTop = s.vars.top;
  s.locals.result = s.get(oldTop).value;
  await viz.step(3, 'Save the top value (' + s.locals.result + ') in result, before we lose the node.', { [oldTop]: 'found' });

  s.vars.top = s.get(oldTop).next;
  await viz.step(4, 'Move top down to the next node (' + s.valueOf(s.vars.top) + '). Nothing points to the old top any more.', { [oldTop]: 'removed' });

  s.ints.count--;
  await viz.step(5, 'count goes down to ' + s.ints.count + '.', { [oldTop]: 'removed' });

  const result = s.locals.result;
  await viz.step(6, 'Return ' + result + '.', { [oldTop]: 'removed' });
  viz.finish('pop() returned ' + result + '.');
}


async function stackPeek(viz) {
  const s = viz.store;
  viz.setCode(STACK_CODE.peek);

  if (s.ints.count === 0) {
    await viz.step(0, 'isEmpty() is true: count is 0.');
    await viz.step(1, 'There\'s nothing to look at, so the method throws an exception.');
    viz.finish('EmptyCollectionException: the stack is empty.', 'error');
    return;
  }
  await viz.step(0, 'isEmpty() is false.');
  const value = s.valueOf(s.vars.top);
  await viz.step(3, 'Return the top value (' + value + '). Unlike pop, peek doesn\'t remove anything.', { [s.vars.top]: 'found' });
  viz.finish('peek() returned ' + value + '.');
}


function setupStack() {
  const store = new NodeStore('top', ['top'], true);
  const viz = new Viz('st', store, 'vertical');
  const valueInput = document.getElementById('st-value');

  const reset = () => {
    store.build([3, 1, 2]);   // top first: 3 is on top
    viz.setCode(STACK_CODE.push);
    viz.show(-1, 'A stack with 3 on top. Push adds on top; pop takes the top off.', {});
    viz.setResult('', '');
  };

  document.getElementById('st-push').addEventListener('click', () => {
    const value = viz.readNumber(valueInput);
    if (value == null || !viz.hasRoom()) return;
    Player.run(async () => { await stackPush(viz, value); valueInput.value = randomValue(); });
  });
  document.getElementById('st-pop').addEventListener('click', () => Player.run(() => stackPop(viz)));
  document.getElementById('st-peek').addEventListener('click', () => Player.run(() => stackPeek(viz)));
  document.getElementById('st-reset').addEventListener('click', reset);

  reset();
  return viz;
}
