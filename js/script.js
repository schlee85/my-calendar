function sameDate(a, b) {
	return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function parseDate(str) {
	const [y, m, d] = str.split('-').map(Number);
	return new Date(y, m - 1, d);
}

function dateKey(date) {
	const y = date.getFullYear();
	const m = String(date.getMonth() + 1).padStart(2, '0');
	const d = String(date.getDate()).padStart(2, '0');
	return `${y}-${m}-${d}`;
}

const MEMBERS = CALENDAR_DATA.members;
const schedule = CALENDAR_DATA.schedule
	.map((ev) => ({
		memberIndex: MEMBERS.findIndex((m) => m.name === ev.member),
		title: ev.title,
		start: parseDate(ev.start),
		end: parseDate(ev.end),
	}))
	.sort((a, b) => a.start - b.start);

const today = new Date();
let viewYear = today.getFullYear();
let viewMonth = today.getMonth(); // 0-indexed
let selectedDate = new Date(viewYear, viewMonth, today.getDate());

const monthLabel = document.getElementById('monthLabel');
const grid = document.getElementById('grid');
const legend = document.getElementById('legend');
const eventList = document.getElementById('eventList');
const selectedLabel = document.getElementById('selectedLabel');

function renderLegend() {
	legend.innerHTML = '';
	MEMBERS.forEach((member) => {
		const item = document.createElement('div');
		item.className = 'legend-item';
		const dot = document.createElement('span');
		dot.className = 'dot';
		dot.style.background = member.color;
		item.appendChild(dot);
		const label = document.createElement('span');
		label.textContent = member.name;
		item.appendChild(label);
		legend.appendChild(item);
	});
}

function eventsForDate(dateObj) {
	return schedule
		.filter((ev) => dateObj >= ev.start && dateObj <= ev.end)
		.sort((a, b) => a.memberIndex - b.memberIndex || a.end - b.end);
}

function render() {
	monthLabel.textContent = `${viewYear}년 ${viewMonth + 1}월`;
	grid.innerHTML = '';

	const firstOfMonth = new Date(viewYear, viewMonth, 1);
	const lastOfMonth = new Date(viewYear, viewMonth + 1, 0);

	// Monday of the week containing a given date (Mon=0 ... Sun=6 offset)
	function mondayOf(date) {
		const offset = (date.getDay() + 6) % 7;
		const d = new Date(date);
		d.setDate(d.getDate() - offset);
		return d;
	}
	function fridayOf(date) {
		const monday = mondayOf(date);
		const d = new Date(monday);
		d.setDate(d.getDate() + 4);
		return d;
	}

	const rangeStart = mondayOf(firstOfMonth);
	const rangeEnd = fridayOf(lastOfMonth);

	const cells = [];
	const cursor = new Date(rangeStart);
	while (cursor <= rangeEnd) {
		const dow = cursor.getDay();
		if (dow >= 1 && dow <= 5) {
			cells.push({
				date: new Date(cursor),
				out: cursor.getMonth() !== viewMonth || cursor.getFullYear() !== viewYear,
			});
		}
		cursor.setDate(cursor.getDate() + 1);
	}

	const weeks = [];
	for (let i = 0; i < cells.length; i += 5) {
		weeks.push(cells.slice(i, i + 5));
	}

	weeks.forEach((week) => {
		const inMonthDates = week.filter((c) => !c.out).map((c) => c.date);

		// 이번 주에 걸리는 일정만 모아 "담당자 순서 -> 산출일(마감일)이 가까운 순"으로 정렬한 뒤,
		// 겹치지 않는 가장 낮은 줄부터 채워나갑니다. 이렇게 하면
		//   - 담당자 순서대로 쌓이는 기본 정렬은 유지되고
		//   - 앞 담당자가 이번 주에 일정이 없으면 그 자리를 뒷사람 막대가 그대로 채우고
		//   - 한 사람의 여러 일정도 서로 붙어서 쌓이되, 그 안에서는 마감일이 가까운 것부터 쌓입니다.
		// 다만 줄 번호는 "이번 주" 기준으로 다시 계산되므로, 여러 주에 걸친 막대는
		// 주가 바뀌는 경계에서 줄이 한 칸 정도 옮겨질 수 있습니다.
		const weekEvents = schedule.filter((ev) => inMonthDates.some((date) => date >= ev.start && date <= ev.end));
		weekEvents.sort((a, b) => a.memberIndex - b.memberIndex || a.end - b.end);

		const rowEnds = [];
		const rowOwner = [];
		const weekRow = new Map();
		const weekSegmentStart = new Map();
		weekEvents.forEach((ev) => {
			const datesInRange = inMonthDates.filter((date) => date >= ev.start && date <= ev.end);
			weekSegmentStart.set(ev, datesInRange[0]);

			// 1) 같은 담당자가 쓰던 줄 중 비어있는 걸 최우선으로 재사용 (그 중 가장 최근에 끝난 줄)
			//    -> 한 사람의 여러 막대가 서로 떨어지지 않고 붙어서 쌓임.
			let row = -1;
			let latestEnd = null;
			rowEnds.forEach((end, idx) => {
				if (rowOwner[idx] === ev.memberIndex && end < ev.start && (latestEnd === null || end > latestEnd)) {
					latestEnd = end;
					row = idx;
				}
			});
			// 2) 같은 담당자 줄이 없으면, 다른 담당자가 비운 줄 중 가장 앞줄을 채움
			//    -> 앞 담당자가 그 기간에 일정이 없으면 뒷사람 막대가 그 자리를 채움.
			if (row === -1) row = rowEnds.findIndex((end) => end < ev.start);
			// 3) 그래도 없으면 새 줄
			if (row === -1) row = rowEnds.length;

			rowEnds[row] = ev.end;
			rowOwner[row] = ev.memberIndex;
			weekRow.set(ev, row);
		});
		const rowCount = Math.max(rowEnds.length, 1);
		const eventsByRow = Array.from({ length: rowCount }, (_, row) =>
			weekEvents.filter((ev) => weekRow.get(ev) === row)
		);

		week.forEach((c) => {
			const cell = document.createElement('div');
			cell.className = 'cell' + (c.out ? ' out' : '');

			const isToday = !c.out && sameDate(c.date, today);
			const isSelected = !c.out && sameDate(c.date, selectedDate);
			if (isToday) cell.classList.add('today');
			if (isSelected) cell.classList.add('selected');

			const head = document.createElement('div');
			head.className = 'cell-head';

			const num = document.createElement('div');
			num.className = 'date-num';
			num.textContent = c.date.getDate();
			head.appendChild(num);

			const holidayName = !c.out && KR_HOLIDAYS[dateKey(c.date)];
			if (holidayName) {
				cell.classList.add('holiday-cell');
				if (!isToday) num.classList.add('holiday');
				const holidayLabel = document.createElement('span');
				holidayLabel.className = 'holiday-label';
				holidayLabel.textContent = holidayName;
				head.appendChild(holidayLabel);
			}

			cell.appendChild(head);

			const lanes = document.createElement('div');
			lanes.className = 'lanes';

			if (!c.out) {
				for (let row = 0; row < rowCount; row++) {
					const ev = eventsByRow[row].find((e) => c.date >= e.start && c.date <= e.end);
					const lane = document.createElement('div');
					lane.className = 'lane';
					if (ev) {
						const member = MEMBERS[ev.memberIndex];
						lane.style.background = member.color;
						const isStart = sameDate(c.date, ev.start);
						const isEnd = sameDate(c.date, ev.end);
						const isWeekSegmentStart = sameDate(c.date, weekSegmentStart.get(ev));
						if (isStart) lane.classList.add('round-left');
						if (isEnd) lane.classList.add('round-right');
						if (isWeekSegmentStart) {
							const laneText = document.createElement('span');
							laneText.className = 'lane-text';
							laneText.textContent = ev.title;
							lane.appendChild(laneText);
						}
					} else {
						lane.style.background = 'transparent';
					}
					lanes.appendChild(lane);
				}
			}
			cell.appendChild(lanes);

			cell.addEventListener('click', () => {
				selectedDate = new Date(c.date);
				if (c.out) {
					viewYear = selectedDate.getFullYear();
					viewMonth = selectedDate.getMonth();
				}
				render();
			});

			grid.appendChild(cell);
		});
	});

	renderEventList();
}

function renderEventList() {
	const y = selectedDate.getFullYear();
	const m = selectedDate.getMonth();
	const d = selectedDate.getDate();
	selectedLabel.textContent = `${y}년 ${m + 1}월 ${d}일 일정`;

	const evts = eventsForDate(selectedDate);
	eventList.innerHTML = '';
	if (evts.length === 0) {
		const li = document.createElement('li');
		li.innerHTML = `<span class="empty-note">등록된 일정이 없습니다.</span>`;
		eventList.appendChild(li);
		return;
	}
	evts.forEach((ev) => {
		const member = MEMBERS[ev.memberIndex];
		const li = document.createElement('li');
		const dot = document.createElement('span');
		dot.className = 'dot';
		dot.style.background = member.color;
		li.appendChild(dot);
		const span = document.createElement('span');
		span.textContent = `${member.name} · ${ev.title}`;
		if (sameDate(selectedDate, ev.end)) {
			span.classList.add('deadline-text');
		}
		li.appendChild(span);
		if (sameDate(selectedDate, ev.end)) {
			const badge = document.createElement('span');
			badge.className = 'badge';
			badge.textContent = '산출일';
			li.appendChild(badge);
		}
		eventList.appendChild(li);
	});
}

document.getElementById('prevBtn').addEventListener('click', () => {
	viewMonth--;
	if (viewMonth < 0) {
		viewMonth = 11;
		viewYear--;
	}
	render();
});
document.getElementById('nextBtn').addEventListener('click', () => {
	viewMonth++;
	if (viewMonth > 11) {
		viewMonth = 0;
		viewYear++;
	}
	render();
});
document.getElementById('todayBtn').addEventListener('click', () => {
	viewYear = today.getFullYear();
	viewMonth = today.getMonth();
	selectedDate = new Date(today);
	render();
});
renderLegend();
render();
