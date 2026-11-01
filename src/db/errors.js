// 백엔드 ErrorCode.java 메시지 중 PWA에서 쓰는 것만
export const ErrorCode = {
  TRANSACTION_NOT_FOUND : '거래를 찾을 수 없습니다.',
  TRANSACTION_INVALID : '거래 정보가 올바르지 않습니다. 종류·금액·날짜·메모를 확인해 주세요.',
  CATEGORY_NOT_FOUND : '카테고리를 찾을 수 없습니다.',
  CATEGORY_NOT_DELETABLE : '기본 카테고리는 삭제할 수 없습니다.',
  CATEGORY_IN_USE : '사용 중인 카테고리는 삭제할 수 없습니다.',
  ASSET_NOT_FOUND : '자산을 찾을 수 없습니다.',
  TAG_NOT_FOUND : '태그를 찾을 수 없습니다.',
  TAG_CATEGORY_MISMATCH : '선택한 카테고리에 속하지 않은 태그입니다.',
  STATS_PERIOD_INVALID : '조회 기간이 올바르지 않습니다.',
  INVALID_REQUEST : '요청 값이 올바르지 않습니다.',
  REORDER_INVALID : '정렬 순서 요청이 올바르지 않습니다.',
  TRANSFER_INVALID : '이체는 출금 자산과 입금 자산을 서로 다르게 지정해야 합니다.',
  ASSET_LINK_INVALID : '체크카드는 연결할 입출금 계좌를 선택해야 합니다.',
  ASSET_LINK_LOCKED : '거래 내역이 있는 체크카드는 연결 계좌나 종류를 바꿀 수 없습니다.',
  ASSET_TYPE_LOCKED : '거래 내역이 있는 자산은 현금·입출금 계좌 사이에서만 종류를 바꿀 수 있습니다.',
  ASSET_HAS_LINKED_CARDS : '체크카드가 연결된 계좌는 종류를 바꿀 수 없습니다.',
  BACKUP_INVALID : '백업 파일 형식이 올바르지 않습니다.',
};

// 백엔드 BusinessException 역할. 화면은 error.message를 그대로 보여준다 (errorMessage.js)
export class BusinessError extends Error {
  constructor(code) {
    super(ErrorCode[code] ?? code);
    this.code = code;
  }
}

export const fail = (code) => {
  throw new BusinessError(code);
};

// 필수 문자열: 공백만 있거나 최대 길이를 넘으면 거부 (Inputs.requireText)
export const requireText = (value, maxLength) => {
  if (value == null || String(value).trim() === '' || String(value).length > maxLength) {
    fail('INVALID_REQUEST');
  }
};

// 화면에서 넘어온 id는 문자열('3')이거나 빈 문자열일 수 있어 숫자/ null로 통일
export const toId = (value) => (value === '' || value == null ? null : Number(value));

// SortOrders.rearrange: all(현재 정렬순)에서 ids 항목들이 차지한 자리에 ids 순서대로 다시 끼워 넣음
export const rearrange = (all, ids) => {
  const list = (ids ?? []).map(Number);
  const byId = new Map(all.map((item) => [item.id, item]));
  const moved = new Set(list);
  if (!list.length || moved.size !== list.length || !list.every((id) => byId.has(id))) {
    fail('REORDER_INVALID');
  }
  let next = 0;
  return all.map((item) => (moved.has(item.id) ? byId.get(list[next++]) : item));
};
