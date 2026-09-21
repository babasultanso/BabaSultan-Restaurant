# Baba Sultan ERP — Live Test Fixes

## Issues confirmed from the Live test
1. A branch-scoped inventory subscription used `where(branchId == ...) + orderBy(...)`, which can fail when the required composite index is not deployed. The repository now performs the branch filter in Firestore and sorts the returned branch-scoped items/movements in memory.
2. User creation previously accepted free-text branch values. The backend now resolves an entered branch document ID, code, name, or branchName to the actual Firestore branch document ID before provisioning the user.
3. Provisioning a user with the `Manager` role now records `managerId` and `managerName` on the canonical branch document.
4. Editing a user's role to/from `Manager` synchronizes `managerId` and `managerName` on that branch record.
5. The User Management branch field is now a branch selector populated from Firestore instead of free text.

## Live verification after deployment
- Keep the existing inventory item `دقيق` (10 kg) unchanged.
- Sign in as `Asiyo Cabdi`.
- Open Inventory Dashboard.
- Expected: Total Items = 1; `دقيق` is visible with 10 kg; valuation is $10.00.
- Open Branch Management.
- Expected: `Baba Sultan / BR-01` shows `Manager: Asiyo Cabdi`.
- Then continue to Recipe → Production → Sales → Accounts.
