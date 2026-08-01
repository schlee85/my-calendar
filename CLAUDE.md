# 우리카드 운영 퍼블팀 캘린더

GitHub Pages로 배포되는 팀 일정 관리 캘린더입니다.

## 파일 구조

```
index.html        HTML 뼈대
css/style.css     스타일
js/data.js        팀원 정보 + 일정 데이터  ← 일정 추가 시 이 파일 수정
js/memos.js       메모 데이터              ← 메모 추가 시 이 파일 수정
js/holidays.js    공휴일 데이터
js/script.js      렌더링 로직
```

## 팀원 목록

| 이름 | 색상           |
| ---- | -------------- |
| 승찬 | #ec4899 (분홍) |
| 승준 | #6366f1 (보라) |
| 용훈 | #10b981 (초록) |
| 용수 | #f59e0b (주황) |

## 일정 추가 방법 (`js/data.js`)

`CALENDAR_DATA.schedule` 배열에 항목 추가:

```javascript
{ member: '승찬', title: '[SR] 제목', start: '2026-08-01', end: '2026-08-05' },
```

- `member`: 팀원 이름 (위 목록 중 하나)
- `title`: `[카테고리] 제목` 형식. 카테고리는 `SR`, `EV`, `CD` 사용
- `start` / `end`: `YYYY-MM-DD` 형식. 당일 완료 일정은 start = end

### 요청 예시

> "용훈 [EV] 캐리비안베이 8/1~8/3 일정 추가해줘"

---

## 메모 추가 방법 (`js/memos.js`)

`MEMO_DATA` 배열에 항목 추가:

```javascript
{ text: '최승준 - 오전반차', start: '2026-08-01', end: '2026-08-01' },
```

- 날짜 범위 지정 가능: `start`와 `end`가 다르면 `(1/3)` 형식으로 일차 표시
- 메모가 있는 날짜 셀에는 파란 점(●)이 표시됨

## 공휴일 추가 방법 (`js/holidays.js`)

`KR_HOLIDAYS` 객체에 키-값 추가:

```javascript
'2026-10-09': '한글날',
```

## 카테고리 종류

- `[SR]` — 운영 (SR)
- `[EV]` — 이벤트 (EV)
- `[CD]` — 카드상품 (CD)

주간 완료 리포트에서 카테고리별 건수가 집계됩니다 (종료일 기준).

## Git 푸시 방법

```bash
git add js/data.js
git commit -m "일정 추가: 내용"
git push
```

GitHub Pages 배포까지 보통 1~2분 소요. 캐시 때문에 시크릿 모드에서 확인 권장.

## GitHub Pages URL

https://schlee85.github.io/my-calendar/

---

## 구현 방식 요약

### 캘린더 그리드
- 주(week) 단위로 렌더링. 각 주는 CSS Grid `grid-template-rows: 36px auto`
  - 1행: 날짜 셀 (`.cell`) — 날짜 숫자, 공휴일 라벨, 메모 점
  - 2행: 막대 레이어 (`.week-bars`) — `grid-column: 1 / -1`로 전체 폭 차지

### 막대 (bar) 렌더링
- 일정이 여러 주에 걸치면 주별로 잘라서 각각 렌더링
- 레인(lane) 알고리즘: 겹치는 일정끼리 다른 행에 배치 (`laneMap`으로 레인 추적)
- `round-left`: 일정 시작일 (왼쪽 둥근 모서리 + 좌측 여백)
- `round-right`: 일정 종료일 (오른쪽 둥근 모서리 + 우측 여백)
- 이어지는 방향은 `clip-path: polygon()`으로 화살표 모양 처리
  - 오른쪽 이어짐: `calc(100% - 8px) 0, 100% 50%, calc(100% - 8px) 100%`
  - 왼쪽 이어짐: `8px 0, 0 50%, 8px 100%`
- 이전/다음 달 날짜에도 막대가 표시되도록 `inMonthDates`는 주의 전체 5일 사용

### 공휴일 오버레이
- 공휴일 날짜의 막대 위에 `.bar-holiday-overlay`(흰색 반투명)를 덮음
- 막대와 동일한 `clip-path`로 화살표 모양 유지
- `pointer-events: none`으로 클릭 방해 없음

### 스티키 헤더
- `.calendar-header { position: sticky; top: 0 }`
- `.app { overflow: clip }` — `overflow: hidden`이면 sticky가 동작 안 함

### 메모 시스템
- `js/memos.js`의 `MEMO_DATA` 배열로 관리 (data.js와 동일 방식)
- 날짜 범위 지정 시 `(1/3)` 형식으로 일차 자동 계산
- 메모가 있는 날짜 셀에 파란 점(`.memo-dot`) 표시

### 주간 완료 리포트
- 선택 날짜 기준 월~금 사이에 `ev.end`가 걸리는 일정 집계
- `[SR]`, `[EV]`, `[CD]` 카테고리 파싱 후 SR > EV > CD 순 정렬
- 기타 카테고리는 뒤에 추가
