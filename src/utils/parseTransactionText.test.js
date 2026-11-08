import {describe, expect, it} from 'vitest';
import {parseTransactionText} from './parseTransactionText.js';

const now = new Date(2026, 9, 15); // 2026-10-15
const assets = [
  {id : 1, name : '국민은행', type : 'BANK'},
  {id : 2, name : '삼성카드', type : 'CARD'},
  {id : 3, name : 'KB체크', type : 'CHECK_CARD'},
];
const tags = [{id : 10, name : '카페', categoryId : 100}];
const categories = [{id : 100, name : '식비'}, {id : 200, name : '쇼핑'}];
const parse = (text) => parseTransactionText(text, {assets, tags, categories, now});

describe('금액', () => {
  it.each([
    ['스벅 4500', 4500], ['스벅 4,500원', 4500], ['점심 3천', 3000], ['책 1.5만', 15000],
    ['월세 2만5천', 25000], ['노트북 1억', 100000000], ['커피 500원', 500],
  ])('%s → %i', (text, amount) => expect(parse(text).amount).toBe(amount));

  it('단위 없는 100 미만 숫자는 수량으로 본다', () => expect(parse('커피 3').amount).toBeNull());
  it('0과 빈 입력은 금액이 아니다', () => {
    expect(parse('0원').amount).toBeNull();
    expect(parse('').amount).toBeNull();
    expect(parse(null).amount).toBeNull();
  });
  it('부호가 종류를 정한다', () => {
    expect(parse('+5000').type).toBe('INCOME');
    expect(parse('월급 -5000').type).toBe('EXPENSE');
  });
});

describe('날짜', () => {
  it.each([
    ['오늘 커피 4500', '2026-10-15'], ['어제 커피 4500', '2026-10-14'], ['그제 커피 4500', '2026-10-13'],
    ['10/20 커피 4500', '2026-10-20'], ['10월20일 커피 4500', '2026-10-20'], ['14일 커피 4500', '2026-10-14'],
    ['20일 커피 4500', '2026-09-20'],
  ])('%s → %s', (text, date) => expect(parse(text).date).toBe(date));
  it('13월 같은 값은 날짜가 아니다', () => expect(parse('13/40 커피 4500').date).toBeNull());
  it('달이 넘어가는 어제', () => {
    const r = parseTransactionText('어제 1000원', {now : new Date(2026, 0, 1)});
    expect(r.date).toBe('2025-12-31');
  });
});

describe('날짜 회귀', () => {
  const dateOn = (text, at) => parseTransactionText(text, {now : at}).date;

  it.each([
    ['11/1의 31일은 10/31', new Date(2026, 10, 1), '2026-10-31'],
    ['3/15의 31일은 2월을 건너뛰고 1/31', new Date(2026, 2, 15), '2026-01-31'],
    ['1/15의 31일은 작년 12/31', new Date(2026, 0, 15), '2025-12-31'],
    ['10/31의 31일은 오늘', new Date(2026, 9, 31), '2026-10-31'],
  ])('%s', (_, at, date) => expect(dateOn('31일 커피 4500', at)).toBe(date));

  it('평년이면 3/1의 29일은 1/29, 윤년이면 2/29', () => {
    expect(dateOn('29일 커피 4500', new Date(2026, 2, 1))).toBe('2026-01-29');
    expect(dateOn('29일 커피 4500', new Date(2028, 2, 1))).toBe('2028-02-29');
  });
  it('달력에 없는 날짜는 날짜로 보지 않는다', () => {
    expect(dateOn('2/31 커피 4500', now)).toBeNull();
    expect(dateOn('2월30일 커피 4500', now)).toBeNull();
    expect(dateOn('2/29 커피 4500', new Date(2026, 9, 15))).toBeNull();
    expect(dateOn('2/29 커피 4500', new Date(2028, 9, 15))).toBe('2028-02-29');
  });
  it('연초의 연말 날짜는 작년, 가까운 미래 날짜는 올해', () => {
    expect(dateOn('12/30 커피 4500', new Date(2026, 0, 2))).toBe('2025-12-30');
    expect(dateOn('12/25 커피 4500', new Date(2026, 10, 1))).toBe('2026-12-25');
  });
});

describe('수입 키워드 회귀', () => {
  it.each(['이자카야 30000', '수입과자 5000', '이자카야에서 3만'])('%s → 지출', (text) => {
    expect(parse(text).type).toBe('EXPENSE');
  });
  it.each(['월급 300만', '월급날 300만', '10월월급 300만', '예금이자 5000', '이자를 5000', '부수입 3만', '용돈받음 3만'])(
    '%s → 수입', (text) => expect(parse(text).type).toBe('INCOME'));
});

describe('체크카드 이체 회귀', () => {
  it('체크카드는 이체 자산에서 빠지고 내용에 남는다', () => {
    const r = parse('kb체크 국민 이체 1000');
    expect(r).toMatchObject({type : 'TRANSFER', assetId : 1, toAssetId : null});
    expect(r.memo).toContain('kb체크');
  });
  it('지출에서는 체크카드를 그대로 쓴다', () => expect(parse('kb체크 스벅 4500').assetId).toBe(3));
});

describe('종류·자산·태그', () => {
  it('자산과 태그, 내용을 분리한다', () => {
    const r = parse('어제 스벅 4500 삼성카드 #카페');
    expect(r).toMatchObject({amount : 4500, assetId : 2, tagId : 10, categoryId : 100, memo : '스벅', type : 'EXPENSE'});
  });
  it('수입 키워드', () => expect(parse('월급 300만').type).toBe('INCOME'));
  it('카테고리명', () => expect(parse('쇼핑 3만').categoryId).toBe(200));
  it('자산 조사와 대소문자를 무시한다', () => expect(parse('kb체크로 5000').assetId).toBe(3));
  it('# 없이 태그명과 같은 단어는 태그만 설정하고 내용에서 뺀다', () => {
    const r = parse('스벅 카페 4500');
    expect(r).toMatchObject({tagId : 10, categoryId : 100, memo : '스벅'});
  });
  it('태그명 단어만 있으면 내용은 비운다', () => expect(parse('카페 4500')).toMatchObject({tagId : 10, memo : ''}));
  it('등록되지 않은 #태그는 내용으로 남는다', () => expect(parse('#없는태그 4500').memo).toBe('없는태그'));

  it('이체는 카드를 입금 쪽으로 보낸다', () => {
    const r = parse('삼성카드 국민 카드값 30만');
    expect(r).toMatchObject({type : 'TRANSFER', assetId : 1, toAssetId : 2, amount : 300000});
  });
  it('카드결제 단어만으로는 이체가 아니다', () => expect(parse('스벅 카드결제 4500').type).toBe('EXPENSE'));
  it('메모는 100자로 자른다', () => expect(parse('가'.repeat(150)).memo).toHaveLength(100));
});
