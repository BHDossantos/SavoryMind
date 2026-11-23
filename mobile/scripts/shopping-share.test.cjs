const test = require('node:test');
const assert = require('node:assert/strict');
const { formatShoppingShare } = require('../services/shoppingShare.cjs');

test('shares visible category and item order, not profile data', () => {
  assert.equal(formatShoppingShare({ Produce: ['Carrots', 'Apples'], Pantry: ['Rice'] }, 'Shopping List'),
    'Shopping List\n\nProduce\n• Carrots\n• Apples\n\nPantry\n• Rice');
});
test('empty or malformed lists have no native share payload', () => {
  for (const categories of [null, {}, { Produce: [' ', null, 2], Pantry: 'Rice' }]) {
    assert.equal(formatShoppingShare(categories, 'Shopping List'), null);
  }
});
test('preserves translated title and ingredient quantities without input mutation', () => {
  const items = Object.freeze([' 2 × tomates ', '梨']);
  assert.equal(formatShoppingShare({ Frutas: items }, 'Lista de compras'), 'Lista de compras\n\nFrutas\n• 2 × tomates\n• 梨');
  assert.equal(items[0], ' 2 × tomates ');
});
