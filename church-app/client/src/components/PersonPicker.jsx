import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { fullName } from '../api.js';

// Accent- and case-insensitive text for matching ("jose" finds "José")
const plain = (s) => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const STATUS = { visitor: 'Visita', inactive: 'Inactivo' };

/**
 * Type-ahead picker. Suggests people from the list as you type; only someone from that list can be chosen.
 * Calls onChange(personId) when one is picked, and onChange('') when the choice is cleared or the text is edited.
 */
export default function PersonPicker({
  people, value, onChange, placeholder = 'Escribe un nombre', excludeId, autoFocus,
  noResults = 'No hay nadie con ese nombre en la base de datos.',
}) {
  const listId = useId();
  const [text, setText] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const prev = useRef('');
  const skipClear = useRef(false);

  const pool = useMemo(() => people.filter((p) => p._id !== excludeId), [people, excludeId]);
  const selected = pool.find((p) => p._id === value);

  // Show the chosen person's name; clear the box when the parent resets the choice (e.g. after saving).
  useEffect(() => {
    if (value) setText(fullName(pool.find((p) => p._id === value)) || '');
    else if (prev.current) {
      if (skipClear.current) skipClear.current = false;
      else setText('');
    }
    prev.current = value;
  }, [value, pool]);

  const matches = useMemo(() => {
    const terms = plain(text).split(/\s+/).filter(Boolean);
    return pool
      .filter((p) => {
        const hay = plain(`${p.firstName} ${p.lastName} ${p.phone || ''}`);
        return terms.every((t) => hay.includes(t));
      })
      .sort((a, b) => a.lastName.localeCompare(b.lastName) || a.firstName.localeCompare(b.firstName))
      .slice(0, 50);
  }, [pool, text]);

  const pick = (p) => {
    setText(fullName(p));
    setOpen(false);
    onChange(p._id);
  };

  const onInput = (e) => {
    if (value) skipClear.current = true; // editing the text un-picks the person, but keep what was typed
    setText(e.target.value);
    setActive(0);
    setOpen(true);
    onChange('');
  };

  const onKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setOpen(true);
      setActive((i) => Math.min(i + 1, matches.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && open && matches[active]) {
      e.preventDefault(); // pick the suggestion, don't submit the form
      pick(matches[active]);
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  };

  useEffect(() => {
    document.getElementById(`${listId}-${active}`)?.scrollIntoView({ block: 'nearest' });
  }, [active, listId]);

  const unmatched = text.trim() && !selected && !open;

  return (
    <div className="picker">
      <input
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={open && matches[active] ? `${listId}-${active}` : undefined}
        value={text}
        placeholder={placeholder}
        autoComplete="off"
        autoFocus={autoFocus}
        onChange={onInput}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={onKeyDown}
      />
      {selected && (
        <button type="button" className="picker-clear" aria-label="Quitar selección" onMouseDown={(e) => e.preventDefault()} onClick={() => { setText(''); onChange(''); }}>×</button>
      )}
      {open && (
        <ul id={listId} role="listbox" className="picker-list" onMouseDown={(e) => e.preventDefault()}>
          {matches.map((p, i) => (
            <li
              key={p._id}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === active}
              className={i === active ? 'active' : ''}
              onMouseEnter={() => setActive(i)}
              onClick={() => pick(p)}
            >
              <strong>{fullName(p)}</strong>
              <span className="muted small">
                {[p.phone, p.section && `Sección ${p.section}`, STATUS[p.status]].filter(Boolean).join(' · ')}
              </span>
            </li>
          ))}
          {!matches.length && <li className="picker-empty muted small">{noResults}</li>}
        </ul>
      )}
      {unmatched && <span className="small error">Elige a la persona de la lista de sugerencias.</span>}
    </div>
  );
}
