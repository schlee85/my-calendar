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
const weekSummary = document.getElementById('weekSummary');
const memoSection = document.getElementById('memoSection');
const memoLabel_el = document.getElementById('memoLabel');
const memoList = document.getElementById('memoList');
const memoSchedule = MEMO_DATA.map((m) => ({
	text: m.text,
	start: parseDate(m.start),
	end: parseDate(m.end),
}));

function memosForDate(dateObj) {
	return memoSchedule.filter((m) => dateObj >= m.start && dateObj <= m.end);
}

function memoLabel(m, dateObj) {
	const totalDays = Math.round((m.end - m.start) / 86400000) + 1;
	if (totalDays <= 1) return m.text;
	const dayNum = Math.round((dateObj - m.start) / 86400000) + 1;
	return `${m.text} (${dayNum}/${totalDays})`;
}

function renderLegend() {
	legend.innerHTML = '';
	MEMBERS.filter((member) => member.name !== '미정').forEach((member) => {
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
	return schedule.filter((ev) => dateObj >= ev.start && dateObj <= ev.end).sort((a, b) => a.memberIndex - b.memberIndex || a.end - b.end);
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
		const inMonthDates = week.map((c) => c.date);

		// 이번 주에 걸리는 일정만 모아 담당자 순서대로 줄을 배정합니다. 규칙:
		//   - 겹치지만 않으면 한 줄을 여러 담당자가 나눠 쓸 수 있습니다.
		//   - 이미 배정된 일정은 절대 다시 옮기지 않습니다 (뒤에 새로 생기는 일정 때문에
		//     이미 화면에 나오고 있는 막대 위치가 바뀌면 안 되므로).
		//   - 같은 날 새로 시작하는 일정이 여럿이면, "지금 이 시점에 아직 진행 중인(=이 담당자의
		//     현재 활성 줄)" 자리와 가장 가까운 빈 줄부터 채웁니다. 즉 위쪽이라서 무조건 우선이
		//     아니라, 현재 진행 중인 막대 바로 옆(위/아래)에 붙는 빈 자리를 우선으로 씁니다.
		//     그 후보 자리들 중에서는 마감일이 빠른 일정부터 더 위쪽 자리에 배정합니다.
		const weekEvents = schedule.filter((ev) => inMonthDates.some((date) => date >= ev.start && date <= ev.end));

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
			const memberEvents = weekEvents.filter((ev) => ev.memberIndex === idx).sort((a, b) => a.start - b.start || a.end - b.end);
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

				// 지금 이 시점에 아직 진행 중인(비어있지 않은) 이 담당자의 줄 = 기준점
				const anchorRows = [];
				if (minRow !== null) {
					for (let r = minRow; r <= maxRow; r++) {
						if (!rowIsFreeFor(r, batchStart, batchMaxEnd)) anchorRows.push(r);
					}
				}

				// 빈 자리 후보를 두 그룹으로 모은다: 이미 확보한 범위 "안"의 빈 줄(자기 막대들
				// 사이에 끼워넣을 수 있는 자리) vs 그 범위 "밖"으로 넓혀야 하는 빈 줄.
				// 안쪽 자리를 항상 먼저 쓰고, 그래도 모자랄 때만 바깥쪽으로 넓힙니다.
				const internalCandidates = [];
				if (minRow !== null) {
					for (let r = minRow; r <= maxRow; r++) {
						if (rowIsFreeFor(r, batchStart, batchMaxEnd)) internalCandidates.push(r);
					}
				}
				const externalCandidates = [];
				const baseUp = minRow === null ? 0 : minRow;
				for (let dist = 1; dist <= 20 && externalCandidates.length < needed + 10; dist++) {
					const r = baseUp - dist;
					if (r >= 0 && rowIsFreeFor(r, batchStart, batchMaxEnd)) externalCandidates.push(r);
				}
				const baseDown = maxRow === null ? -1 : maxRow;
				for (let dist = 1; dist <= 20 && externalCandidates.length < needed + 10; dist++) {
					const r = baseDown + dist;
					if (rowIsFreeFor(r, batchStart, batchMaxEnd)) externalCandidates.push(r);
				}

				// 각 그룹 안에서는 기준점(anchorRows)과 가장 가까운 빈 자리부터 우선 사용.
				// 기준점이 없으면(이 담당자가 처음 등장하는 경우) 위쪽(작은 번호) 자리부터 채운다.
				function distanceToAnchor(row) {
					if (!anchorRows.length) return row;
					return Math.min(...anchorRows.map((a) => Math.abs(a - row)));
				}
				internalCandidates.sort((a, b) => distanceToAnchor(a) - distanceToAnchor(b) || a - b);
				externalCandidates.sort((a, b) => distanceToAnchor(a) - distanceToAnchor(b) || a - b);
				const candidates = [...internalCandidates, ...externalCandidates];
				const slots = candidates.slice(0, needed).sort((a, b) => a - b);
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

		const weekEl = document.createElement('div');
		weekEl.className = 'week';

		week.forEach((c, colIdx) => {
			const cell = document.createElement('div');
			cell.className = 'cell' + (c.out ? ' out' : '');
			cell.style.gridColumn = `${colIdx + 1}`;

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

			if (memosForDate(c.date).length > 0) {
				const dot = document.createElement('span');
				dot.className = 'memo-dot';
				head.appendChild(dot);
			}

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

			cell.addEventListener('click', () => {
				selectedDate = new Date(c.date);
				if (c.out) {
					viewYear = selectedDate.getFullYear();
					viewMonth = selectedDate.getMonth();
				}
				render();
			});

			weekEl.appendChild(cell);
		});

		// 담당자 막대: 요일 셀 하나하나가 아니라, 이번 주에 걸친 구간 전체를 진짜 하나의
		// 요소로 그려서 (grid-column을 span) 날짜 경계마다 끊기지 않는 실제 막대로 만듭니다.
		const barsEl = document.createElement('div');
		barsEl.className = 'week-bars';
		barsEl.style.gridTemplateRows = `repeat(${rowCount}, var(--lane-h))`;

		weekEvents.forEach((ev) => {
			const datesInRange = inMonthDates.filter((date) => date >= ev.start && date <= ev.end);
			if (!datesInRange.length) return;
			const segStart = datesInRange[0];
			const segEnd = datesInRange[datesInRange.length - 1];
			const colStart = week.findIndex((c) => sameDate(c.date, segStart));
			const colEnd = week.findIndex((c) => sameDate(c.date, segEnd));
			if (colStart === -1 || colEnd === -1) return;

			const bar = document.createElement('div');
			bar.className = 'bar';
			const member = MEMBERS[ev.memberIndex];
			bar.style.background = member.color;
			bar.style.gridColumn = `${colStart + 1} / ${colEnd + 2}`;
			bar.style.gridRow = `${weekRow.get(ev) + 1}`;
			if (sameDate(segStart, ev.start)) bar.classList.add('round-left');
			if (sameDate(segEnd, ev.end)) bar.classList.add('round-right');

			const catMatch = ev.title.match(/^\[([^\]]+)\]\s*/);
			if (catMatch) {
				const badge = document.createElement('span');
				badge.className = `bar-badge bar-badge--${catMatch[1].toLowerCase()}`;
				badge.textContent = catMatch[1];
				bar.appendChild(badge);
			}
			const barText = document.createElement('span');
			barText.className = 'bar-text';
			barText.textContent = catMatch ? ev.title.slice(catMatch[0].length) : ev.title;
			bar.appendChild(barText);


			barsEl.appendChild(bar);

			datesInRange.forEach((date) => {
				if (!KR_HOLIDAYS[dateKey(date)]) return;
				const colIdx = week.findIndex((c) => sameDate(c.date, date));
				if (colIdx === -1) return;
				const overlay = document.createElement('div');
				overlay.className = 'bar-holiday-overlay';
				overlay.style.gridColumn = `${colIdx + 1}`;
				overlay.style.gridRow = `${weekRow.get(ev) + 1}`;

				const isFirst = colIdx === colStart;
				const isLast = colIdx === colEnd;
				const leftArrow = isFirst && !sameDate(segStart, ev.start);
				const rightArrow = isLast && !sameDate(segEnd, ev.end);
				const leftRound = isFirst && sameDate(segStart, ev.start);
				const rightRound = isLast && sameDate(segEnd, ev.end);

				if (leftArrow && rightArrow) {
					overlay.style.clipPath = 'polygon(8px 0, calc(100% - 8px) 0, 100% 50%, calc(100% - 8px) 100%, 8px 100%, 0 50%)';
				} else if (leftArrow) {
					overlay.style.clipPath = 'polygon(8px 0, 100% 0, 100% 100%, 8px 100%, 0 50%)';
				} else if (rightArrow) {
					overlay.style.clipPath = 'polygon(0 0, calc(100% - 8px) 0, 100% 50%, calc(100% - 8px) 100%, 0 100%)';
				}
				if (leftRound) overlay.style.marginLeft = 'var(--bar-gap)';
				if (rightRound) overlay.style.marginRight = 'var(--bar-gap)';

				barsEl.appendChild(overlay);
			});
		});

		weekEl.appendChild(barsEl);
		grid.appendChild(weekEl);
	});

	renderEventList();
}

function renderWeekSummary() {
	const offset = (selectedDate.getDay() + 6) % 7;
	const monday = new Date(selectedDate);
	monday.setDate(selectedDate.getDate() - offset);
	const friday = new Date(monday);
	friday.setDate(monday.getDate() + 4);

	const completed = schedule.filter((ev) => ev.end >= monday && ev.end <= friday);

	weekSummary.innerHTML = '';

	const fmt = (d) => `${d.getMonth() + 1}/${d.getDate()}`;
	const label = document.createElement('h2');
	label.textContent = `${fmt(monday)} ~ ${fmt(friday)} 완료 예정`;
	weekSummary.appendChild(label);

	if (completed.length === 0) {
		const empty = document.createElement('p');
		empty.className = 'empty-note';
		empty.textContent = '완료된 일감이 없습니다.';
		weekSummary.appendChild(empty);
	} else {
		const counts = {};
		completed.forEach((ev) => {
			const match = ev.title.match(/^\[([^\]]+)\]/);
			const cat = match ? match[1] : '기타';
			counts[cat] = (counts[cat] || 0) + 1;
		});
		const chips = document.createElement('div');
		chips.className = 'week-summary-chips';
		const ORDER = ['SR', 'EV', 'CD'];
		const sorted = [...ORDER.filter((c) => counts[c]), ...Object.keys(counts).filter((c) => !ORDER.includes(c))];
		sorted.forEach((cat) => {
			const chip = document.createElement('span');
			chip.className = 'week-summary-chip';
			const badge = document.createElement('span');
			badge.className = `bar-badge bar-badge--${cat.toLowerCase()}`;
			badge.textContent = cat;
			chip.appendChild(badge);
			const countText = document.createElement('span');
			countText.textContent = ` ${counts[cat]}건`;
			chip.appendChild(countText);
			chips.appendChild(chip);
		});
		weekSummary.appendChild(chips);
	}
}

function renderEventList() {
	renderWeekSummary();
	const dateMemos = memosForDate(selectedDate);
	memoList.innerHTML = '';
	if (dateMemos.length > 0) {
		memoSection.style.display = '';
		memoLabel_el.textContent = `${selectedDate.getFullYear()}년 ${selectedDate.getMonth() + 1}월 ${selectedDate.getDate()}일 메모`;
		dateMemos.forEach((m) => {
			const li = document.createElement('li');
			li.textContent = memoLabel(m, selectedDate);
			memoList.appendChild(li);
		});
	} else {
		memoSection.style.display = 'none';
	}
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
		const catMatch = ev.title.match(/^\[([^\]]+)\]\s*/);
		if (catMatch) {
			const badge = document.createElement('span');
			badge.className = `bar-badge bar-badge--${catMatch[1].toLowerCase()}`;
			badge.textContent = catMatch[1];
			li.appendChild(badge);
		}
		const span = document.createElement('span');
		span.textContent = `${member.name} · ${catMatch ? ev.title.slice(catMatch[0].length) : ev.title}`;
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

let statsFilter = null; // null = 전체, {year, month} = 특정 월

function renderStatsBody() {
	const body = document.getElementById('statsBody');
	body.innerHTML = '';

	// 월 목록 추출 (종료일 기준)
	const monthSet = new Set();
	schedule.forEach((ev) => {
		monthSet.add(`${ev.end.getFullYear()}-${ev.end.getMonth()}`);
	});
	const months = Array.from(monthSet)
		.sort()
		.map((key) => {
			const [y, m] = key.split('-').map(Number);
			return { year: y, month: m };
		});

	// 월 드롭다운
	const filters = document.createElement('div');
	filters.className = 'stats-filters';

	const select = document.createElement('select');
	select.className = 'stats-select';

	const allOpt = document.createElement('option');
	allOpt.value = '';
	allOpt.textContent = '전체';
	select.appendChild(allOpt);

	months.forEach(({ year, month }) => {
		const opt = document.createElement('option');
		opt.value = `${year}-${month}`;
		opt.textContent = `${year}년 ${month + 1}월`;
		if (statsFilter && statsFilter.year === year && statsFilter.month === month) opt.selected = true;
		select.appendChild(opt);
	});

	select.addEventListener('change', () => {
		if (!select.value) {
			statsFilter = null;
		} else {
			const [y, m] = select.value.split('-').map(Number);
			statsFilter = { year: y, month: m };
		}
		renderStatsBody();
	});

	filters.appendChild(select);
	body.appendChild(filters);

	// 일정 필터링 (종료일 기준)
	const filtered = statsFilter
		? schedule.filter((ev) => ev.end.getFullYear() === statsFilter.year && ev.end.getMonth() === statsFilter.month)
		: schedule;

	// 테이블
	const ORDER = ['SR', 'EV', 'CD'];
	const table = document.createElement('table');
	table.className = 'stats-table';

	const colgroup = document.createElement('colgroup');
	[28, 18, 18, 18, 18].forEach((w) => {
		const col = document.createElement('col');
		col.style.width = `${w}%`;
		colgroup.appendChild(col);
	});
	table.appendChild(colgroup);

	const thead = document.createElement('thead');
	const headerRow = document.createElement('tr');
	['작업자', 'SR', 'EV', 'CD', '합계'].forEach((h) => {
		const th = document.createElement('th');
		th.textContent = h;
		headerRow.appendChild(th);
	});
	thead.appendChild(headerRow);
	table.appendChild(thead);

	const tbody = document.createElement('tbody');
	MEMBERS.filter((m) => m.name !== '미정').forEach((member) => {
		const memberIdx = MEMBERS.findIndex((m) => m.name === member.name);
		const memberEvents = filtered.filter((ev) => ev.memberIndex === memberIdx);

		const counts = {};
		memberEvents.forEach((ev) => {
			const match = ev.title.match(/^\[([^\]]+)\]/);
			const cat = match ? match[1] : '기타';
			counts[cat] = (counts[cat] || 0) + 1;
		});
		const total = Object.values(counts).reduce((a, b) => a + b, 0);

		const tr = document.createElement('tr');

		const tdName = document.createElement('td');
		const dot = document.createElement('span');
		dot.className = 'dot';
		dot.style.background = member.color;
		tdName.appendChild(dot);
		tdName.appendChild(document.createTextNode(member.name));
		tr.appendChild(tdName);

		ORDER.forEach((cat) => {
			const td = document.createElement('td');
			td.textContent = `${counts[cat] || 0}건`;
			tr.appendChild(td);
		});

		const tdTotal = document.createElement('td');
		tdTotal.className = 'stats-total';
		tdTotal.textContent = `${total}건`;
		tr.appendChild(tdTotal);

		tbody.appendChild(tr);
	});
	table.appendChild(tbody);
	body.appendChild(table);
}

function openStatsModal() {
	statsFilter = null;
	renderStatsBody();
	document.getElementById('statsModal').classList.add('open');
	document.body.style.overflow = 'hidden';
}

function closeStatsModal() {
	document.getElementById('statsModal').classList.remove('open');
	document.body.style.overflow = '';
}

document.getElementById('statsBtn').addEventListener('click', openStatsModal);
document.getElementById('statsClose').addEventListener('click', closeStatsModal);
document.getElementById('statsModal').addEventListener('click', (e) => {
	if (e.target === e.currentTarget) closeStatsModal();
});

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
	selectedDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());
	render();
});

renderLegend();
render();
