const KNOWN_BRANCH_ALIASES: Record<string, string> = {
  'all': 'all',
  'main_branch_01': 'main_branch_01',
  'branch_hq_01': 'branch_hq_01',
  'branch_hargeisa_01': 'branch_hargeisa_01',
  'branch_kismayo_01': 'branch_kismayo_01',
  'hq': 'branch_hq_01',
  'hq-mog-01': 'branch_hq_01',
  'br-001': 'branch_hq_01',
  'mogadishu main': 'branch_hq_01',
  'headquarters': 'branch_hq_01',
  'main branch': 'branch_hq_01',
  'main flagship branch': 'branch_hq_01',
  'br-har-02': 'branch_hargeisa_01',
  'hargeisa branch': 'branch_hargeisa_01',
  'hargeisa flagship branch': 'branch_hargeisa_01',
  'br-kis-03': 'branch_kismayo_01',
  'kismayo branch': 'branch_kismayo_01',
  'kismayo coastal express': 'branch_kismayo_01',
  'branch_a': 'branch_a',
  'branch_b': 'branch_b'
};

export function getCanonicalBranchId(rawBranch?: string | null): string {
  if (!rawBranch || typeof rawBranch !== 'string') return '';
  const trimmed = rawBranch.trim();
  if (!trimmed) return '';
  const lower = trimmed.toLowerCase();
  if (KNOWN_BRANCH_ALIASES[lower]) {
    return KNOWN_BRANCH_ALIASES[lower];
  }
  return trimmed;
}

export function areBranchesMatching(b1?: string | null, b2?: string | null): boolean {
  if (!b1 || !b2) return false;
  const c1 = getCanonicalBranchId(b1);
  const c2 = getCanonicalBranchId(b2);
  if (!c1 || !c2) return false;
  if (c1 === c2) return true;
  const isHQ1 = c1 === 'branch_hq_01' || c1 === 'main_branch_01' || c1 === 'hq-mog-01';
  const isHQ2 = c2 === 'branch_hq_01' || c2 === 'main_branch_01' || c2 === 'hq-mog-01';
  if (isHQ1 && isHQ2) return true;
  return false;
}

export function getBranchDisplayName(branchId?: string | null): string {
  const canon = getCanonicalBranchId(branchId);
  if (canon === 'branch_hargeisa_01') return 'Hargeisa Flagship Branch';
  if (canon === 'branch_kismayo_01') return 'Kismayo Coastal Express';
  if (canon === 'branch_hq_01' || canon === 'main_branch_01') return 'Headquarters - Mogadishu Main';
  if (canon === 'all') return 'All Branches (HQ)';
  return 'Unassigned Branch';
}
