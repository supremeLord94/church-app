// Tags a person can have in ONE gathering. `single`: only one person can hold it (tagging someone else moves it).
// Células use all of them; casas de paz use only leader, coleader and host.
export const ROLES = {
  leader: { label: 'Líder', single: true, types: ['celula', 'casa_de_paz'] },
  coleader: { label: 'Co-líder', single: false, types: ['celula', 'casa_de_paz'] },
  subleader: { label: 'Sublíder', single: true, types: ['celula'] },
  host: { label: 'Anfitrión', single: true, types: ['celula', 'casa_de_paz'] },
  word: { label: 'Palabra', single: true, types: ['celula'] },
  praise: { label: 'Alabanzas', single: true, types: ['celula'] },
  prayer: { label: 'Oración', single: false, types: ['celula'] },
  offering: { label: 'Ofrendas', single: false, types: ['celula'] },
};
export const rolesFor = (type) => Object.keys(ROLES).filter((k) => ROLES[k].types.includes(type));

/**
 * Put a tag on a person or take it off, in a list of { person, roles }.
 * A single-holder tag moves from its current holder; the leader tag can't be removed, only moved.
 * Becoming the leader drops the person's co-leader tag, and the leader can't also be co-leader.
 * Returns { unchanged } | { error } | { previous } (previous = who held a single tag before).
 */
export function applyRole(participants, personId, role, on) {
  const p = participants.find((x) => String(x.person) === String(personId));
  if (!p) return { error: 'not-found' };
  const has = p.roles.includes(role);
  if (on === has) return { unchanged: true };
  if (!on) {
    if (role === 'leader') return { error: 'leader-required' };
    p.roles = p.roles.filter((r) => r !== role);
    return {};
  }
  if (role === 'coleader' && p.roles.includes('leader')) return { error: 'already-leader' };
  let previous = null;
  if (ROLES[role].single) {
    const holder = participants.find((x) => x !== p && x.roles.includes(role));
    if (holder) {
      holder.roles = holder.roles.filter((r) => r !== role);
      previous = holder.person;
    }
  }
  p.roles.push(role);
  if (role === 'leader') p.roles = p.roles.filter((r) => r !== 'coleader');
  return { previous };
}
