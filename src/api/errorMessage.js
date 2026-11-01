export function getErrorMessage(error) {
  return error?.message ?? '요청 처리 중 오류가 발생했습니다.';
}