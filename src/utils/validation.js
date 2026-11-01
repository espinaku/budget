// DB 컬럼 크기와 어긋나지 않도록 숫자 입력값의 자릿수를 검사한다.
// JS Number는 2^53(약 15~16자리)까지만 정밀도가 보장되므로, DB가 더 큰 범위(BIGINT)를
// 허용하더라도 그 값까지만 허용해 정밀도 손실을 막는다.
export function digitLengthError(value, maxDigits, label = '값') {
  const digits = String(Math.trunc(Math.abs(Number(value) || 0))).length;
  if (digits > maxDigits) {
    return `${label}은(는) 최대 ${maxDigits}자리까지 입력할 수 있습니다.`;
  }
  return '';
}
