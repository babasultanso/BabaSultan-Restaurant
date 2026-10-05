import { describe, it, expect } from 'vitest';
import { sanitizeCSVCell } from '../src/lib/reports';

describe('PHASE 13: CSV Formula Injection Sanitization Suite', () => {
  it('neutralizes formula injection characters (=, +, -, @, \\t, \\r)', () => {
    // 1. Equal sign command injection
    expect(sanitizeCSVCell("=cmd|' /C calc'!A0")).toBe(`"'=cmd|' /C calc'!A0"`);

    // 2. Plus sign formula
    expect(sanitizeCSVCell('+1+2')).toBe(`"'+1+2"`);

    // 3. Minus sign formula
    expect(sanitizeCSVCell('-2+3*4')).toBe(`"'-2+3*4"`);

    // 4. At sign formula
    expect(sanitizeCSVCell('@SUM(1,2)')).toBe(`"'@SUM(1,2)"`);

    // 5. Tab and carriage return prefix
    expect(sanitizeCSVCell('\ttab_injection')).toBe(`"'\ttab_injection"`);
    expect(sanitizeCSVCell('\rcarriage_injection')).toBe(`"'\rcarriage_injection"`);

    // 6. Normal string and escaping internal quotes
    expect(sanitizeCSVCell('Normal Item Name')).toBe(`"Normal Item Name"`);
    expect(sanitizeCSVCell('Pizza "Deluxe"')).toBe(`"Pizza ""Deluxe"""`);

    // 7. Null and undefined safety
    expect(sanitizeCSVCell(null)).toBe('""');
    expect(sanitizeCSVCell(undefined)).toBe('""');

    // 8. Numbers
    expect(sanitizeCSVCell(123.45)).toBe('"123.45"');
  });
});
