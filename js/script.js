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
const schedule = CALENDAR_DATA.schedule.map((ev) => ({
	memberIndex: MEMBERS.findIndex((m) => m.name === ev.member),
	title: ev.title,
	start: parseDate(ev.start),
	end: parseDate(ev.end),
}));

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
	return schedule.filter((ev) => dateObj >= ev.start && dateObj <= ev.end);
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

	cells.forEach((c) => {
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
				const dayEvents = schedule
					.filter((e) => e.memberIndex === idx && c.date >= e.start && c.date <= e.end)
					.sort((a, b) => a.start - b.start);

				const primary = dayEvents[0];
				const lane = document.createElement('div');
				lane.className = 'lane';
				if (primary) {
					lane.style.background = member.color;
					const isStart = sameDate(c.date, primary.start);
					const isEnd = sameDate(c.date, primary.end);
					if (isStart) lane.classList.add('round-left');
					if (isEnd) lane.classList.add('round-right');
					lane.textContent = isStart ? `${member.name} · ${primary.title}` : '';
				} else {
					lane.style.background = 'transparent';
				}
				lanes.appendChild(lane);

				dayEvents.slice(1).forEach((ev) => {
					const extraLane = document.createElement('div');
					extraLane.className = 'lane round-left round-right';
					extraLane.style.background = member.color;
					extraLane.textContent = `${member.name} · ${ev.title}`;
					lanes.appendChild(extraLane);
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
		li.appendChild(span);
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
