const PATHS = {
  home: 'M3 10l7-6 7 6v7a1 1 0 0 1-1 1h-3v-5H7v5H4a1 1 0 0 1-1-1z',
  check: 'M4 10.5l4 4 8-9',
  alert: 'M10 2a8 8 0 1 0 0 16 8 8 0 0 0 0-16zM10 6v5M10 14h.01',
  people: 'M7 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM2 17c0-3 2.5-5 5-5s5 2 5 5M13 9a2.5 2.5 0 1 0 0-5M13 12c2.5 0 5 1.8 5 5',
  book: 'M3 4h5a2 2 0 0 1 2 2v11a2 2 0 0 0-2-2H3zM17 4h-5a2 2 0 0 0-2 2v11a2 2 0 0 1 2-2h5z',
  shield: 'M10 2l7 3v5c0 4-3 7-7 8-4-1-7-4-7-8V5z',
  menu: 'M3 5h14M3 10h14M3 15h14',
  plus: 'M10 4v12M4 10h12',
  minus: 'M10 2a8 8 0 1 0 0 16 8 8 0 0 0 0-16zM6.5 10h7',
  tag: 'M3.5 3.5h6l7 7-6 6-7-7zM7 7h.01',
  chat: 'M4 4h12a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H9l-4 3v-3H4a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1zM7 8h6M7 11h4',
  log: 'M6 3h8a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1zM8 7h4M8 10h4M8 13h2',
  close: 'M5 5l10 10M15 5L5 15',
};

export default function Icon({ name }) {
  return (
    <svg className="icon" viewBox="0 0 20 20" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={PATHS[name]} />
    </svg>
  );
}
