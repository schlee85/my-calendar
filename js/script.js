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

// 같은 담당자의 일정이 겹칠 때도 각 일정이 항상 같은 줄(레인)에 표시되도록,
// 일정마다 레인을 한 번만 고정 배정합니다. (매일 다시 계산하면 막대가 중간에 줄을 옮겨 끊겨 보임)
const memberLaneEnds = {};
schedule.forEach((ev) => {
	const laneEnds = memberLaneEnds[ev.memberIndex] || (memberLaneEnds[ev.memberIndex] = []);
	// 비어있는 줄 중 "가장 최근에 끝난" 줄을 재사용 (번호가 작은 줄을 무조건 우선하면
	// 훨씬 이전에 끝난 일정 자리로 배정돼 방금 끝난 일정과 이어지는 느낌이 안 남)
	let laneIdx = -1;
	let latestEnd = null;
	laneEnds.forEach((end, idx) => {
		if (end < ev.start && (latestEnd === null || end > latestEnd)) {
			latestEnd = end;
			laneIdx = idx;
		}
	});
	if (laneIdx === -1) laneIdx = laneEnds.length;
	laneEnds[laneIdx] = ev.end;
	ev.lane = laneIdx;
});

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
		.sort((a, b) => a.memberIndex - b.memberIndex || a.lane - b.lane);
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
		// 이 주(week)에 실제로 걸리는 레인 목록만 모음 — 번호만 크고 이 주엔 아무 일정도
		// 없는 레인(예: 이미 끝난 일정 자리)은 아예 그리지 않아 빈 줄 간격이 안 생김.
		const weekActiveLanes = {};
		// 일정이 이 주(week) 이전부터 이어져 오는 경우, 이 주의 첫 날에도 라벨을 보여주기 위한 기준일.
		const weekSegmentStart = new Map();
		schedule.forEach((ev) => {
			const datesInRange = inMonthDates.filter((date) => date >= ev.start && date <= ev.end);
			if (datesInRange.length) {
				const lanes = weekActiveLanes[ev.memberIndex] || (weekActiveLanes[ev.memberIndex] = []);
				if (!lanes.includes(ev.lane)) lanes.push(ev.lane);
				weekSegmentStart.set(ev, datesInRange[0]);
			}
		});
		Object.keys(weekActiveLanes).forEach((idx) => {
			weekActiveLanes[idx].sort((a, b) => a - b);
		});

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
				MEMBERS.forEach((member, idx) => {
					const activeLanes = weekActiveLanes[idx] && weekActiveLanes[idx].length ? weekActiveLanes[idx] : [0];
					activeLanes.forEach((laneIdx) => {
						const ev = schedule.find(
							(e) => e.memberIndex === idx && e.lane === laneIdx && c.date >= e.start && c.date <= e.end
						);
						const lane = document.createElement('div');
						lane.className = 'lane';
						if (ev) {
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
					});
				});
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
