// 이체 종류: 입금 자산이 카드면 카드대금, 그 외는 자산 이동
export const transferKind = (toAsset) => {
  if (!toAsset) return '이체';
  return toAsset.type === 'CARD' ? '카드대금' : '자산 이동';
}