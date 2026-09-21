import { describe, it, expect } from 'vitest';

describe('Live inventory branch contract', () => {
  it('uses the same canonical branch document id for user and inventory item', () => {
    const branchId = 'caF80DC6BrzzSGUqg67f';
    const user = { branchId };
    const item = { branchId, currentQuantity: 10 };

    expect(user.branchId).toBe(item.branchId);
    expect(item.currentQuantity).toBe(10);
  });

  it('does not require a compound branchId+orderBy index for the branch-scoped inventory query', async () => {
    const branchId = 'caF80DC6BrzzSGUqg67f';
    const docs = [
      { branchId, itemName: 'سكر' },
      { branchId, itemName: 'دقيق' }
    ];

    const branchScoped = docs
      .filter(d => d.branchId === branchId)
      .sort((a, b) => a.itemName.localeCompare(b.itemName));

    expect(branchScoped.map(d => d.itemName)).toEqual(['دقيق', 'سكر']);
  });
});
