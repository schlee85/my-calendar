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

		// 이번 주에 걸리는 일정만 모아 담당자 순서대로 줄을 배정합니다. 규칙:
		//   - 겹치지만 않으면 한 줄을 여러 담당자가 나눠 쓸 수 있습니다.
		//   - 이미 배정된 일정은 절대 다시 옮기지 않습니다 (뒤에 새로 생기는 일정 때문에
		//     이미 화면에 나오고 있는 막대 위치가 바뀌면 안 되므로).
		//   - 같은 날 새로 시작하는 일정이 여럿이면, 그 담당자가 이미 확보한 범위 안의 빈 줄을
		//     먼저 채우고, 모자라면 위/아래로 한 줄씩 넓혀가며(가까운 쪽부터) 자리를 찾은 뒤,
		//     마감일이 빠른 일정부터 그 중 가장 위쪽 자리에 배정합니다. 그래서 이미 진행 중이던
		//     일정은 자리를 지키고, 새로 시작하는 일정들끼리 마감일 순으로 그 위/아래 빈 자리를
		//     채우게 됩니다.
		const weekEvents = schedule.filter((ev) => inMonthDates.some((date) => date >= ev.start && date <= ev.end));

		const weekSegmentStart = new Map();
		weekEvents.forEach((ev) => {
			const datesInRange = inMonthDates.filter((date) => date >= ev.start && date <= ev.end);
			weekSegmentStart.set(ev, datesInRange[0]);
		});

		const rowOccupied = []; // rowOccupied[row] = 그 줄에 이미 배치된 일정들의 {start, end} 목록
		const weekRow = new Map();
		function rowIsFreeFor(row, start, end) {
			const occ = rowOccupied[row];
			return !occ || !occ.some((r) => start <= r.end && end >= r.start);
		}
		function occupyRow(row, ev) {
			(rowOccupied[row] || (rowOccupied[row] = [])).push({ start: ev.start, end: ev.end });
		}

		MEMBERS.forEach((member, idx) => {
			const memberEvents = weekEvents
				.filter((ev) => ev.memberIndex === idx)
				.sort((a, b) => a.start - b.start || a.end - b.end);
			if (!memberEvents.length) return;

			let minRow = null;
			let maxRow = null;

			// 시작일이 같은 일정끼리 묶어서 한 번에 처리
			const batches = [];
			memberEvents.forEach((ev) => {
				const last = batches[batches.length - 1];
				if (last && sameDate(last[0].start, ev.start)) last.push(ev);
				else batches.push([ev]);
			});

			batches.forEach((batch) => {
				const batchStart = batch[0].start;
				const batchMaxEnd = new Date(Math.max(...batch.map((ev) => ev.end.getTime())));
				const needed = batch.length;
				const slots = [];

				if (minRow !== null) {
					for (let r = minRow; r <= maxRow && slots.length < needed; r++) {
						if (rowIsFreeFor(r, batchStart, batchMaxEnd)) slots.push(r);
					}
				}
				let up = minRow === null ? -1 : minRow - 1;
				let down = maxRow === null ? 0 : maxRow + 1;
				while (slots.length < needed) {
					if (up >= 0) {
						if (rowIsFreeFor(up, batchStart, batchMaxEnd)) slots.push(up);
						up--;
					}
					if (slots.length >= needed) break;
					if (rowIsFreeFor(down, batchStart, batchMaxEnd)) slots.push(down);
					down++;
				}

				slots.sort((a, b) => a - b);
				const sortedBatch = [...batch].sort((a, b) => a.end - b.end);

				sortedBatch.forEach((ev, i) => {
					const row = slots[i];
					weekRow.set(ev, row);
					occupyRow(row, ev);
					minRow = minRow === null ? row : Math.min(minRow, row);
					maxRow = maxRow === null ? row : Math.max(maxRow, row);
				});
			});
		});

		const rowCount = Math.max(rowOccupied.length, 1);
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
