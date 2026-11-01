# budget-pwa

아이폰 홈 화면에 추가해서 쓰는 개인 가계부 (PWA).
`budgetV1/frontend`의 화면을 그대로 가져오고, 서버·로그인·메일·AI를 모두 걷어냈다.

## 구조

- 데이터는 **이 기기 브라우저의 IndexedDB**에만 저장된다 (Dexie.js). 서버 없음, 비밀값 없음.
- `src/api/*.js` : V1의 REST 호출 함수와 **같은 이름·같은 반환 형태**로 IndexedDB를 읽고 쓴다.
  백엔드 서비스의 규칙(잔액 반영, 체크카드 연결 계좌, 이체, 카테고리 삭제 제한, 태그 삭제 시 거래 태그 비움,
  메모 추천, 통계)을 JS로 옮겼다. 그래서 페이지 컴포넌트는 거의 그대로다.
- `src/db/db.js` : 테이블 정의, 첫 실행 시 기본 카테고리 8개 생성
- `src/db/transactionRules.js` : 잔액 효과·검색 조건 등 순수 규칙 (DB 없이 테스트 가능)
- `src/api/backupApi.js` : JSON 백업/복원 (설정 > 백업 · 복원)
- 라우터는 `HashRouter` (`/#/transactions`) — 정적 호스팅에서 새로고침해도 404가 나지 않는다.

## 실행

```bash
npm install
npm run dev        # 개발 서버
npm test           # 로직 테스트 (fake-indexeddb)
npm run build      # dist/ 생성 (서비스 워커 포함)
npm run preview    # 빌드 결과 확인
```

같은 와이파이의 아이폰에서 미리 보려면 `npm run dev -- --host` 후 표시되는 네트워크 주소로 접속한다.
(서비스 워커·홈 화면 설치는 https 배포본에서 확인)

## 배포 (정적 호스팅이면 어디든)

`npm run build` 결과인 `dist/` 폴더만 올리면 된다. `base: './'`라서 하위 경로에서도 동작한다.

- **Cloudflare Pages** : private 저장소 연결 가능. Build command `npm run build`, Output `dist`
- **GitHub Pages** : 무료 계정은 public 저장소 필요. Actions로 `dist` 배포

## 아이폰 설치

1. Safari로 배포 주소 접속
2. 공유 버튼 → **홈 화면에 추가**
3. 홈 화면 아이콘으로 실행 (Safari 탭과 홈 화면 앱은 저장소가 서로 다르므로 항상 아이콘으로 실행)

## 백업

설정 > 백업 · 복원 → **백업 파일 내보내기** → 공유 시트에서 **파일에 저장 → iCloud Drive**.
7일 넘게 백업하지 않으면 대시보드 상단에 알림이 뜬다.
복원은 현재 기기 데이터를 **전부 교체**한다.
