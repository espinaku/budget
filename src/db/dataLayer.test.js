import 'fake-indexeddb/auto';
import {beforeEach, describe, expect, it} from 'vitest';
import {db} from './db.js';
import {createAsset, getAsset, getAssetUsage, updateAsset} from '../api/assetApi.js';
import {createCategory, deleteCategory, getCategories, reorderCategories} from '../api/categoryApi.js';
import {createTag, deleteTag, getTagPage, getTags, updateTag} from '../api/tagApi.js';
import {
  createTransaction, deleteTransaction, getDailySums, getSuggestions, searchTransactions, updateTransaction,
} from '../api/transactionApi.js';
import {getCategoryStats, getMonthlyStats, getTagStats} from '../api/statsApi.js';
import {buildBackup, inspectBackup, restoreBackup} from '../api/backupApi.js';

beforeEach(async () => {
  await db.delete();
  await db.open();
});

const tx = (p) => createTransaction({memo : '', transactionDate : '2026-10-10', ...p});

describe('카테고리', () => {
  it('첫 실행 시 기본 카테고리 8개', async () => {
    const list = await getCategories();
    expect(list.map((c) => c.name)).toEqual(['생활비', '식비', '쇼핑', '건강', '여가', '경조사', '수입', '기타']);
    expect(list.every((c) => c.isDefault && c.isVisible)).toBe(true);
  });

  it('기본 카테고리·사용 중 카테고리는 삭제 불가', async () => {
    const [food] = await getCategories();
    await expect(deleteCategory(food.id)).rejects.toThrow('기본 카테고리는 삭제할 수 없습니다.');
    const mine = await createCategory({name : '반려동물'});
    await createTag({categoryId : mine.id, name : '사료'});
    await expect(deleteCategory(mine.id)).rejects.toThrow('사용 중인 카테고리는 삭제할 수 없습니다.');
  });

  it('정렬 변경', async () => {
    const list = await getCategories();
    await reorderCategories([list[1].id, list[0].id]);
    const after = await getCategories();
    expect(after.slice(0, 2).map((c) => c.name)).toEqual(['식비', '생활비']);
  });
});

describe('잔액 반영', () => {
  it('지출·수입·수정·삭제', async () => {
    const [cat] = await getCategories();
    const bank = await createAsset({name : '국민', type : 'BANK', balance : 100000});
    const t = await tx({type : 'EXPENSE', amount : 3000, assetId : bank.id, categoryId : cat.id});
    expect((await getAsset(bank.id)).balance).toBe(97000);

    await updateTransaction(t.id, {...t, type : 'INCOME', amount : 5000});
    expect((await getAsset(bank.id)).balance).toBe(105000);

    await deleteTransaction(t.id);
    expect((await getAsset(bank.id)).balance).toBe(100000);
  });

  it('체크카드 사용은 연결 계좌 잔액에서 빠짐, 신용카드는 변화 없음', async () => {
    const [cat] = await getCategories();
    const bank = await createAsset({name : '국민', type : 'BANK', balance : 50000});
    const check = await createAsset({name : '체크', type : 'CHECK_CARD', linkedAssetId : bank.id, balance : 999});
    const credit = await createAsset({name : '삼성', type : 'CARD'});
    expect(check.balance).toBeNull();

    await tx({type : 'EXPENSE', amount : 1000, assetId : check.id, categoryId : cat.id});
    await tx({type : 'EXPENSE', amount : 7000, assetId : credit.id, categoryId : cat.id});
    expect((await getAsset(bank.id)).balance).toBe(49000);
    expect((await getAsset(credit.id)).balance).toBeNull();

    // 거래가 있는 체크카드는 연결 계좌 변경 불가
    const bank2 = await createAsset({name : '신한', type : 'BANK', balance : 0});
    await expect(updateAsset(check.id, {name : '체크', type : 'CHECK_CARD', linkedAssetId : bank2.id}))
      .rejects.toThrow('거래 내역이 있는 체크카드는');
  });

  it('이체: 계좌→카드(대금), 계좌→투자', async () => {
    const bank = await createAsset({name : '국민', type : 'BANK', balance : 100000});
    const card = await createAsset({name : '삼성', type : 'CARD'});
    const invest = await createAsset({name : '증권', type : 'INVESTMENT', balance : 0});
    await tx({type : 'TRANSFER', amount : 30000, assetId : bank.id, toAssetId : card.id, categoryId : 1, tagId : 1});
    await tx({type : 'TRANSFER', amount : 20000, assetId : bank.id, toAssetId : invest.id});
    expect((await getAsset(bank.id)).balance).toBe(50000);
    expect((await getAsset(invest.id)).balance).toBe(20000);

    await expect(tx({type : 'TRANSFER', amount : 1, assetId : card.id, toAssetId : bank.id}))
      .rejects.toThrow('이체는 출금 자산과');
  });
});

describe('자산 종류 변경 회귀', () => {
  const setup = async () => {
    const [cat] = await getCategories();
    const bank = await createAsset({name : '국민', type : 'BANK', balance : 1000});
    return {cat, bank};
  };

  it('거래가 있으면 잔액 규칙이 다른 종류로 바꿀 수 없다', async () => {
    const {cat, bank} = await setup();
    const t = await tx({type : 'EXPENSE', amount : 100, assetId : bank.id, categoryId : cat.id});
    await expect(updateAsset(bank.id, {name : '국민', type : 'INVESTMENT', balance : 900})).rejects.toThrow('거래 내역이 있는 자산은');
    await expect(updateAsset(bank.id, {name : '국민', type : 'CARD'})).rejects.toThrow('거래 내역이 있는 자산은');

    expect(await getAsset(bank.id)).toMatchObject({type : 'BANK', balance : 900});
    await deleteTransaction(t.id);
    expect((await getAsset(bank.id)).balance).toBe(1000);
  });

  it('이체 입금 내역만 있어도 잠긴다', async () => {
    const {bank} = await setup();
    const invest = await createAsset({name : '증권', type : 'INVESTMENT', balance : 0});
    await tx({type : 'TRANSFER', amount : 100, assetId : bank.id, toAssetId : invest.id});
    await expect(updateAsset(invest.id, {name : '증권', type : 'CARD'})).rejects.toThrow('거래 내역이 있는 자산은');
  });

  it('현금↔계좌는 규칙이 같아 거래가 있어도 허용, 잔액도 유지', async () => {
    const {cat, bank} = await setup();
    const t = await tx({type : 'EXPENSE', amount : 100, assetId : bank.id, categoryId : cat.id});
    await updateAsset(bank.id, {name : '지갑', type : 'CASH', balance : 900});
    await deleteTransaction(t.id);
    expect(await getAsset(bank.id)).toMatchObject({type : 'CASH', balance : 1000});
  });

  it('거래가 없으면 어떤 종류로든 변경 가능', async () => {
    const {bank} = await setup();
    expect(await updateAsset(bank.id, {name : '국민', type : 'CARD'})).toMatchObject({type : 'CARD', balance : null});
  });

  it('체크카드가 연결된 계좌는 거래가 없어도 다른 종류로 바꿀 수 없다', async () => {
    const {bank} = await setup();
    await createAsset({name : '체크', type : 'CHECK_CARD', linkedAssetId : bank.id});
    await expect(updateAsset(bank.id, {name : '국민', type : 'CASH', balance : 1000})).rejects.toThrow('체크카드가 연결된');
    await updateAsset(bank.id, {name : '국민은행', type : 'BANK', balance : 1000});
    expect((await getAsset(bank.id)).name).toBe('국민은행');
  });
});

describe('거래 검증 회귀', () => {
  it('달력에 없는 날짜는 저장 거부', async () => {
    const [cat] = await getCategories();
    await expect(tx({type : 'EXPENSE', amount : 1, categoryId : cat.id, transactionDate : '2026-02-31'}))
      .rejects.toThrow('거래 정보가 올바르지');
    expect(await db.transactions.count()).toBe(0);
  });

  it('다른 카테고리의 태그는 거부', async () => {
    const [a, b] = await getCategories();
    const tag = await createTag({categoryId : a.id, name : '마트'});
    await expect(tx({type : 'EXPENSE', amount : 1, categoryId : b.id, tagId : tag.id})).rejects.toThrow('속하지 않은 태그');
    const t = await tx({type : 'EXPENSE', amount : 1, categoryId : a.id, tagId : tag.id});
    await expect(updateTransaction(t.id, {...t, categoryId : b.id})).rejects.toThrow('속하지 않은 태그');
  });

  it('태그가 다른 카테고리로 옮겨진 과거 거래도 메모는 수정 가능', async () => {
    const [a, b] = await getCategories();
    const tag = await createTag({categoryId : a.id, name : '마트'});
    const t = await tx({type : 'EXPENSE', amount : 1, categoryId : a.id, tagId : tag.id});
    await updateTag(tag.id, {categoryId : b.id, name : '마트'});
    expect(await updateTransaction(t.id, {...t, memo : '수정'})).toMatchObject({memo : '수정', categoryId : a.id, tagId : tag.id});
  });
});

describe('검색·통계', () => {
  it('자산 상세: 거래 후 잔액, 방향 필터, 합계', async () => {
    const [cat] = await getCategories();
    const bank = await createAsset({name : '국민', type : 'BANK', balance : 10000});
    const check = await createAsset({name : '체크', type : 'CHECK_CARD', linkedAssetId : bank.id});
    await tx({type : 'INCOME', amount : 5000, assetId : bank.id, categoryId : cat.id, transactionDate : '2026-10-01'});
    await tx({type : 'EXPENSE', amount : 2000, assetId : check.id, categoryId : cat.id, transactionDate : '2026-10-02'});
    // 현재 잔액 = 10000 + 5000 - 2000
    const res = await searchTransactions({assetId : String(bank.id)});
    expect(res.items.map((t) => t.balanceAfter)).toEqual([13000, 15000]);
    expect(res.summary).toMatchObject({income : 5000, expense : 2000});

    const outOnly = await searchTransactions({assetId : bank.id, direction : 'OUT'});
    expect(outOnly.items).toHaveLength(1);
  });

  it('페이지, 키워드, 일별 합계, 추천', async () => {
    const [living, food] = await getCategories();
    const cafe = await createTag({categoryId : food.id, name : '카페'});
    for (let i = 1; i <= 35; i++) {
      await tx({type : 'EXPENSE', amount : 100, categoryId : food.id, tagId : cafe.id, memo : '스타벅스',
        transactionDate : `2026-10-${String((i % 28) + 1).padStart(2, '0')}`});
    }
    await tx({type : 'EXPENSE', amount : 900, categoryId : living.id, memo : '관리비'});

    const p0 = await searchTransactions({from : '2026-10-01', to : '2026-10-31', page : 0, size : 30});
    expect(p0.totalCount).toBe(36);
    expect(p0.hasNext).toBe(true);
    expect(p0.items[0].tagName === '카페' || p0.items[0].tagName === null).toBe(true);
    const p1 = await searchTransactions({from : '2026-10-01', to : '2026-10-31', page : 1, size : 30});
    expect(p1.items).toHaveLength(6);

    expect((await searchTransactions({keyword : '스타'})).totalCount).toBe(35);
    const daily = await getDailySums({from : '2026-10-01', to : '2026-10-31'});
    expect(daily.reduce((s, d) => s + d.expense, 0)).toBe(4400);

    const sugg = await getSuggestions('스타');
    expect(sugg.matchedCount).toBe(35);
    expect(sugg.categories[0].id).toBe(food.id);
    expect(sugg.tags[0].id).toBe(cafe.id);

    const cat = await getCategoryStats('2026-10');
    expect(cat.items[0]).toMatchObject({categoryName : '식비', totalAmount : 3500});
    const tags = await getTagStats('2026-10', 'EXPENSE');
    expect(tags.tags[0]).toMatchObject({tagName : '카페', categoryName : '식비'});
    const monthly = await getMonthlyStats('2026-05', '2026-10');
    expect(monthly.items).toHaveLength(6);
    expect(monthly.items.at(-1)).toMatchObject({month : '2026-10', expense : 4400});
  });

  it('자산 월 사용액: 체크카드는 연결 계좌에도 합산', async () => {
    const [cat] = await getCategories();
    const bank = await createAsset({name : '국민', type : 'BANK', balance : 0});
    const check = await createAsset({name : '체크', type : 'CHECK_CARD', linkedAssetId : bank.id});
    await tx({type : 'EXPENSE', amount : 1500, assetId : check.id, categoryId : cat.id});
    const usage = await getAssetUsage('2026-10');
    expect(usage.find((u) => u.assetId === bank.id).expense).toBe(1500);
    expect(usage.find((u) => u.assetId === check.id).expense).toBe(1500);
  });
});

describe('태그', () => {
  it('삭제 시 거래의 태그는 비워짐, 페이지 조회', async () => {
    const [cat] = await getCategories();
    const tag = await createTag({categoryId : String(cat.id), name : '마트'});
    const t = await tx({type : 'EXPENSE', amount : 1, categoryId : cat.id, tagId : tag.id});
    await deleteTag(tag.id);
    expect((await db.transactions.get(t.id)).tagId).toBeNull();
    expect(await getTags()).toHaveLength(0);
    expect((await getTagPage({})).totalCount).toBe(0);
  });
});

describe('백업', () => {
  it('내보내기 → 초기화 → 복원', async () => {
    const [cat] = await getCategories();
    const bank = await createAsset({name : '국민', type : 'BANK', balance : 1000});
    await tx({type : 'EXPENSE', amount : 100, assetId : bank.id, categoryId : cat.id});
    const backup = JSON.parse(JSON.stringify(await buildBackup()));

    expect(inspectBackup(backup).counts).toEqual({categories : 8, assets : 1, tags : 0, transactions : 1});
    expect(() => inspectBackup('{"app":"x"}')).toThrow('백업 파일 형식');

    await db.delete();
    await db.open();
    await restoreBackup(backup);
    expect((await getAsset(bank.id)).balance).toBe(900);
    expect((await searchTransactions({})).totalCount).toBe(1);
  });

  describe('행 검증 회귀', () => {
    const validBackup = async () => {
      const [cat] = await getCategories();
      const bank = await createAsset({name : '국민', type : 'BANK', balance : 1000});
      const cash = await createAsset({name : '현금', type : 'CASH'});
      const tag = await createTag({categoryId : cat.id, name : '마트'});
      await tx({type : 'EXPENSE', amount : 100, assetId : bank.id, categoryId : cat.id, tagId : tag.id});
      await tx({type : 'INCOME', amount : 100, categoryId : cat.id}); // 자산 없는 거래
      await tx({type : 'TRANSFER', amount : 100, assetId : bank.id, toAssetId : cash.id});
      return JSON.parse(JSON.stringify(await buildBackup()));
    };

    it('앱이 만든 백업은 모든 종류의 행이 통과한다', async () => {
      const backup = await validBackup();
      expect(inspectBackup(backup).counts).toEqual({categories : 8, assets : 2, tags : 1, transactions : 3});
    });

    it.each([
      ['금액 누락', (d) => delete d.transactions[0].amount],
      ['문자열 금액', (d) => { d.transactions[0].amount = '100'; }],
      ['없는 날짜', (d) => { d.transactions[0].transactionDate = '2026-02-31'; }],
      ['알 수 없는 거래 종류', (d) => { d.transactions[0].type = 'REFUND'; }],
      ['카테고리 없는 지출', (d) => { d.transactions[0].categoryId = null; }],
      ['입금 자산 없는 이체', (d) => { d.transactions[2].toAssetId = null; }],
      ['정렬값 없는 카테고리', (d) => delete d.categories[0].sortOrder],
      ['알 수 없는 자산 종류', (d) => { d.assets[0].type = 'CRYPTO'; }],
      ['숫자가 아닌 잔액', (d) => { d.assets[0].balance = '1000'; }],
      ['카테고리 없는 태그', (d) => delete d.tags[0].categoryId],
    ])('%s: 거부하고 현재 데이터 유지', async (_, corrupt) => {
      const backup = await validBackup();
      corrupt(backup.data);
      await expect(restoreBackup(backup)).rejects.toThrow('백업 파일 형식');
      expect(await db.transactions.count()).toBe(3);
    });
  });
});
