import {describe, expect, it} from 'vitest';
import {digitLengthError} from './validation.js';
import {inAssetTab, isCardType} from '../pages/asset/assetLabels.js';
import {transferKind} from './transfer.js';

describe('digitLengthError', () => {
  it('한도 이내면 빈 문자열', () => expect(digitLengthError(123456789012345, 15, '금액')).toBe(''));
  it('초과하면 메시지', () => expect(digitLengthError(1234567890123456, 15, '금액')).toContain('15자리'));
  it('빈 값·음수·소수', () => {
    expect(digitLengthError('', 3)).toBe('');
    expect(digitLengthError(-999, 3)).toBe('');
    expect(digitLengthError(999.99, 3)).toBe('');
  });
});

describe('자산 규칙', () => {
  it('카드류 판별', () => {
    expect(isCardType('CARD')).toBe(true);
    expect(isCardType('CHECK_CARD')).toBe(true);
    expect(isCardType('BANK')).toBe(false);
  });
  it('입출금 탭에 체크카드가 포함된다', () => {
    expect(inAssetTab('CHECK_CARD', 'BANK')).toBe(true);
    expect(inAssetTab('CHECK_CARD', 'CARD')).toBe(false);
    expect(inAssetTab('CASH', '')).toBe(true);
  });
  it('이체 종류', () => {
    expect(transferKind({type : 'CARD'})).toBe('카드대금');
    expect(transferKind({type : 'BANK'})).toBe('자산 이동');
    expect(transferKind(undefined)).toBe('이체');
  });
});
