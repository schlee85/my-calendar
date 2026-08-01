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
