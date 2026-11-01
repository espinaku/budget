// 자산 종류 표시 이름 (거래 화면 탭 이름과 별개)
export const TYPE_LABEL = {
  CASH : '현금',
  BANK : '입출금 계좌',
  CARD : '신용카드',
  CHECK_CARD : '체크카드',
  INVESTMENT : '투자',
};

export const TYPE_OPTIONS = ['BANK', 'CASH', 'CARD', 'CHECK_CARD', 'INVESTMENT']
  .map((value) => ({value, label : TYPE_LABEL[value]}));

// 잔액이 없는 카드류 (신용·체크). 잔액 대신 월 사용액을 표시
export const isCardType = (type) => type === 'CARD' || type === 'CHECK_CARD';

// 거래 화면 "입출금" 탭에 속하는 종류 (체크카드는 계좌에서 바로 빠져나감)
export const inAssetTab = (assetType, tab) =>
  !tab || assetType === tab || (tab === 'BANK' && assetType === 'CHECK_CARD');
