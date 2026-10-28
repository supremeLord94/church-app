import Gathering from './models/Gathering.js';

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
