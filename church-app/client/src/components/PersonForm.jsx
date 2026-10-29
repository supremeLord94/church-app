import { useEffect, useState } from 'react';
import { api, formatDate, toISO } from '../api.js';
import { noAutofill } from '../noAutofill.js';
import PersonPicker from './PersonPicker.jsx';

// Most people live in the same place, so these are filled in (and can be changed) when empty.
export const DEFAULT_CITY = 'Tijuana';
export const DEFAULT_STATE = 'BC';

const EMPTY = {
  firstName: '', lastName: '', phone: '', birthday: '', section: '', status: 'member',
  invitedBy: '', joinedAt: toISO(new Date()), notes: '', baptized: false, macroencuentro: false,
  address: { street: '', city: DEFAULT_CITY, state: DEFAULT_STATE, zip: '' }, relatives: [],
};

// limited: for teachers, who can register a person but can't browse the rest of the people list,
// so the fields that need that list (invited by, relatives) are left out.
export default function PersonForm({ person, people = [], onSaved, onClose, onDeleted, isAdmin, limited = false, defaults = {} }) {
  const editing = !!person?._id;
  const [form, setForm] = useState(EMPTY);
  const [history, setHistory] = useState([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!editing) return setForm({ ...EMPTY, joinedAt: toISO(new Date()), ...defaults });
    api(`/people/${person._id}`).then((p) => {
      const a = p.address || {};
      setForm({
        ...EMPTY, ...p,
        section: p.section || '',
        baptized: !!p.baptized,
        macroencuentro: !!p.macroencuentro,
        invitedBy: p.invitedBy?._id || '',
        address: { street: a.street || '', city: a.city || DEFAULT_CITY, state: a.state || DEFAULT_STATE, zip: a.zip || '' },
        relatives: (p.relatives || []).map((r) => ({ person: r.person?._id || '', relationship: r.relationship || '' })),
      });
    });
    api(`/people/${person._id}/attendance`).then(setHistory).catch(() => {});
  }, [person?._id]); // eslint-disable-line

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const setYesNo = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value === 'yes' }));
  const setAddr = (k) => (e) => setForm((f) => ({ ...f, address: { ...f.address, [k]: e.target.value } }));
  const setRel = (i, patch) =>
    setForm((f) => ({ ...f, relatives: f.relatives.map((r, j) => (j === i ? { ...r, ...patch } : r)) }));

  async function submit(allowDuplicate = false) {
    setBusy(true);
    setError('');
    try {
      const body = {
        ...form,
        section: form.section ? Number(form.section) : '',
        relatives: form.relatives.filter((r) => r.person),
        allowDuplicate,
      };
      const saved = editing
        ? await api(`/people/${person._id}`, { method: 'PUT', body })
        : await api('/people', { method: 'POST', body });
      onSaved(saved);
    } catch (err) {
      if (err.data?.duplicate && window.confirm(`${err.message}\n\n¿Registrarla de todos modos? Solo si es otra persona con el mismo nombre.`)) {
        return submit(true);
      }
      setError(err.message);
    } finally {
      setBusy(false);
    }
    return undefined;
  }

  async function remove() {
    if (!window.confirm('¿Borrar esta persona y todo su historial de asistencia? Es mejor marcarla como inactiva.')) return;
    await api(`/people/${person._id}`, { method: 'DELETE' });
    onDeleted(person._id);
  }

  return (
    <div className="drawer person" role="dialog" aria-modal="true">
      <form className="sheet" onSubmit={(e) => { e.preventDefault(); submit(false); }}>
        <div className="sheet-head">
          <h2>{editing ? 'Editar persona' : 'Nueva persona'}</h2>
          <button type="button" className="link" onClick={onClose}>Cerrar</button>
        </div>

        <div className="grid3e">
          <label>Nombre<input {...noAutofill('nombre')} value={form.firstName} onChange={set('firstName')} required autoFocus={!editing} /></label>
          <label>Apellido<input autoComplete="family-name" value={form.lastName} onChange={set('lastName')} required /></label>
          <label>Teléfono<input {...noAutofill('telefono')} type="text" inputMode="tel" value={form.phone} onChange={set('phone')} /></label>
          <label>Cumpleaños<input type="date" value={form.birthday} onChange={set('birthday')} /></label>
          <label>Sección
            <select value={form.section} onChange={set('section')}>
              <option value="">Sin sección</option>
              {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>Sección {n}</option>)}
            </select>
          </label>
          <label>Estado
            <select value={form.status} onChange={set('status')}>
              <option value="visitor">Visita</option>
              <option value="member">Miembro</option>
              <option value="inactive">Inactivo</option>
            </select>
          </label>
          <label>Bautizado
            <select value={form.baptized ? 'yes' : 'no'} onChange={setYesNo('baptized')}>
              <option value="no">No</option>
              <option value="yes">Sí</option>
            </select>
          </label>
          <label>Macroencuentro
            <select value={form.macroencuentro ? 'yes' : 'no'} onChange={setYesNo('macroencuentro')}>
              <option value="no">No</option>
              <option value="yes">Sí</option>
            </select>
          </label>
        </div>

        {!limited && (
          <label>Invitado por
            <PersonPicker people={people} value={form.invitedBy} onChange={(id) => setForm((f) => ({ ...f, invitedBy: id }))} excludeId={person?._id} />
          </label>
        )}

        <fieldset>
          <legend>Dirección</legend>
          <label>Calle<input autoComplete="street-address" value={form.address.street} onChange={setAddr('street')} /></label>
          <div className="grid3">
            <label>Ciudad<input autoComplete="address-level2" value={form.address.city} onChange={setAddr('city')} /></label>
            <label>Estado<input autoComplete="address-level1" value={form.address.state} onChange={setAddr('state')} /></label>
            <label>Código postal<input autoComplete="postal-code" value={form.address.zip} onChange={setAddr('zip')} /></label>
          </div>
        </fieldset>

        {!limited && (
          <fieldset>
            <legend>Familiares</legend>
            {form.relatives.map((r, i) => (
              <div className="rel-row" key={i}>
                <PersonPicker people={people} value={r.person} onChange={(id) => setRel(i, { person: id })} excludeId={person?._id} />
                <input placeholder="Parentesco (esposo, hijo…)" value={r.relationship} onChange={(e) => setRel(i, { relationship: e.target.value })} />
                <button type="button" className="link" onClick={() => setForm((f) => ({ ...f, relatives: f.relatives.filter((_, j) => j !== i) }))}>Quitar</button>
              </div>
            ))}
            <button type="button" className="ghost" onClick={() => setForm((f) => ({ ...f, relatives: [...f.relatives, { person: '', relationship: '' }] }))}>
              Agregar familiar
            </button>
          </fieldset>
        )}

        <div className="grid3e">
          {!limited && <label>Primer domingo contado<input type="date" value={form.joinedAt || ''} onChange={set('joinedAt')} /></label>}
          <label className="span2">Notas<textarea rows="2" value={form.notes || ''} onChange={set('notes')} /></label>
        </div>

        {editing && history.length > 0 && (
          <div>
            <p className="muted small">Últimos domingos</p>
            <div className="dots">
              {[...history].reverse().map((h) => (
                <span key={h.date} className={`dot ${h.present ? 'on' : ''}`} title={`${formatDate(h.date)}: ${h.present ? 'asistió' : 'faltó'}`} />
              ))}
            </div>
          </div>
        )}

        {error && <p className="error">{error}</p>}
        <div className="sheet-actions">
          {editing && isAdmin && <button type="button" className="danger" onClick={remove}>Borrar</button>}
          <span style={{ flex: 1 }} />
          <button type="button" className="ghost" onClick={onClose}>Cancelar</button>
          <button className="primary" disabled={busy}>{busy ? 'Guardando…' : 'Guardar'}</button>
        </div>
      </form>
    </div>
  );
}
