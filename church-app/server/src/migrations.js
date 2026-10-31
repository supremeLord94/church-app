import Gathering from './models/Gathering.js';
import Person from './models/Person.js';

// Gatherings made before the new tags had isLeader / isHost flags. Turn them into roles (runs once, safe to repeat).
// Only one leader and one host are kept; an extra leader on a célula becomes the sublíder.
export async function migrateGatheringRoles() {
  const col = Gathering.collection;
  const old = await col.find({ 'participants.isLeader': { $exists: true } }).toArray();
  for (const g of old) {
    let leader = false, host = false, sub = false;
    const participants = g.participants.map((p) => {
      const roles = [];
      if (p.isLeader) {
        if (!leader) { roles.push('leader'); leader = true; }
        else if (g.type === 'celula' && !sub) { roles.push('subleader'); sub = true; }
      }
      if (p.isHost && !host) { roles.push('host'); host = true; }
      return { person: p.person, roles };
    });
    await col.updateOne({ _id: g._id }, { $set: { participants } });
  }
  if (old.length) console.log(`Reuniones actualizadas a las etiquetas nuevas: ${old.length}`);
}

// The old address (street, city, state, zip) is gone. "calle" becomes colonia/barrio, then the address object is removed.
// Uses the raw collection because the Person schema no longer knows `address`. Safe to repeat.
export async function migratePersonColonia() {
  const col = Person.collection;
  const moved = await col.updateMany(
    { colonia: { $exists: false }, 'address.street': { $type: 'string', $ne: '' } },
    [{ $set: { colonia: { $trim: { input: '$address.street' } } } }]
  );
  const cleaned = await col.updateMany({ address: { $exists: true } }, { $unset: { address: '' } });
  if (cleaned.modifiedCount) console.log(`Personas: ${moved.modifiedCount} calles pasadas a colonia/barrio, ${cleaned.modifiedCount} direcciones eliminadas`);
}
