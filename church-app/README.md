# Familia Real church app (MERN): attendance, users, Escuela de Vida

Modules so far: Sunday attendance, people records, user management with roles, Escuela de Vida, and an activity log. The interface is in Spanish with a light theme. On desktop the menu is pinned to the left; on phones and tablets it opens from the menu button (top left).

## Run it

Needs Node 18+ and MongoDB (local, or a free MongoDB Atlas cluster).

```bash
# 1. API
cd server
cp .env.example .env          # set MONGO_URI, a random JWT_SECRET (32+ characters, see Security), and TZ
npm install
npm run create-user -- "Tu Nombre" tu@correo.com UnaClaveLarga123 admin   # first admin only
npm run dev                   # http://localhost:5000

# 2. Web app (new terminal)
cd client
npm install
npm run dev                   # http://localhost:5173
```

To open it from a phone or iPad on the same Wi-Fi, just use the `Network:` address Vite prints (`host: true` is already set in `client/vite.config.js`).

If you used an earlier version, existing "secretary" accounts are converted to the new "usuario" role automatically the first time the API starts.

## Putting it online

See [DEPLOY.md](DEPLOY.md) for step-by-step instructions to run everything on one Ubuntu server: nginx with HTTPS, Node under systemd, MongoDB on the same machine, and backups.

## Branding

The name, logo and colors can be changed in three places: the name in `client/src/App.jsx` and `client/src/pages/Login.jsx`, the logo files in `client/public/` (`logo.png`, `favicon.png`), and the color variables at the top of `client/src/styles.css`.

## Roles

| Role | Can do |
|---|---|
| **Administrador** | Everything: dashboard, attendance, people, Escuela de Vida (groups, students, teachers), users |
| **Usuario** | Take attendance, register new people, edit a person's info. Nothing else. |
| **Líder** | Only the **Reuniones** page: create células and casas de paz for their own section, add people to them, tag who leads and who hosts, and register new people. Plus their own account page. An admin links each leader's login to their person record (that is where their section comes from). |
| **Profesor** | Only the Escuela de Vida groups an admin assigned to them: record attendance and homework, and decide whether each student completed the course. They can also register new people (**Registrar persona**) and add people to their own groups (existing people, or someone they just registered, who is added to the group automatically). They cannot see or edit the people list, and when adding someone to a group they only see names, section and status, never phone, address or birthday. Removing a student from a group stays with admins. Plus their own account page. |

Every user (any role) can change their own name, username, email and password in **Mi cuenta**. Permissions are enforced by the API, not just hidden in the menu.

## Logging in

Users can sign in with their **email or their username**. A username is optional, 6 to 30 characters of lowercase letters and numbers only (no spaces or symbols), and unique. The form checks availability while typing, and the API checks again when saving.

## Users and passwords (admin)

- Passwords must be at least 8 characters (set in `server/src/routes/users.js` and `auth.js`).
- **Usuarios**: create users (name, email, optional username, role, password), edit them, deactivate them, and reset their password.
- New and reset passwords are temporary. The person must choose their own on first login.
- Deactivating a user logs them out on their next request. You cannot deactivate or demote yourself, and at least one active admin always remains.
- To let a teacher see a class: open the group in **Escuela de Vida** and add them under "Profesores de este grupo".

## Attendance

- Sections 1-5 are a field on each person. Status: `visitor`, `member` (counted in "who is missing"), `inactive` (hidden from check-in).
- A Sunday is created the first time someone is marked present. "Missing" means active members who were not marked.
- **Personas** opens the person form as a centered window.
- **Dashboard** also lists everyone with a birthday in the next 4 weeks.
- **Ausentes** lists every member who missed at least one service in the last 6 weeks (the 6 weeks ending at the most recent recorded service). Every missed service counts, in a row or not, and a person is only counted from their first counted Sunday. Most missed first, with how many services they attended. **Crítico** (pink) = 4 or more missed, **Baja** (orange-yellow) = 2 or 3, no tag for 1. Thresholds are `CRITICAL_AT` and `LOW_AT` in `server/src/missing.js`. **Dashboard** shows totals, a 12-week line chart with the goal (black: everyone present, blue: members who attended, green: new people and visitors), and a per-section breakdown (admin only).

## Escuela de Vida

- **Courses**: ABC, Nivel 1, 2, 3. **Groups** take one course together (12 classes by default, adjustable).
- **Registrar clase**: pick the class and date, then tap **Asistió** and **Tarea** per student. The progress grid shows every class at once.
- **Student status** in a group: Activo, Completó, Se retiró. Admins and the group's teachers can change it. "Terminar grupo" (admin) marks everyone still active as completed.
- **At risk**: an active student is flagged after **3 classes in a row without attending, or 3 classes in a row without turning in homework** (`RISK = 3` in `server/src/routes/escuela.js` and `client/src/escuela.js`).
- **Stages** (admin, Alumnos tab): Terminó la escuela, En curso, Se detuvo, No ha empezado. "Registrar curso previo" records a course finished before using the app.
- **Teachers** see only "Mis grupos" and the at-risk students inside them. Only admins create groups, enroll students and assign teachers.

## Reuniones (células and casas de paz)

- A **reunión** is either a **célula** or a **casa de paz**. For a casa de paz you type the class number, 1 to 9 (only those digits are accepted). Each one has a date, optional time and place, and a section.
- **Leaders** (role Líder) see and create reuniones for **their own section** only, so a leader and spouse with separate logins share the same ones. They are linked to a person record by an admin (Usuarios), and that record's section is theirs.
- The person who creates a reunión is **tagged as its leader automatically**. Tags belong to that reunión only, so the next one can have different people.
- **Tags in a célula:** Líder, Sublíder, Anfitrión, Palabra, Alabanzas, Oración and Ofrendas. **Líder, Sublíder, Anfitrión, Palabra and Alabanzas are held by one person**: tagging someone else moves the tag from whoever had it. **Oración and Ofrendas** can be given to several people. One person can have several tags. The leader tag can only be moved, never removed, so a reunión always has a leader (which also means the leader can't be removed from the list).
- **Tags in a casa de paz:** only Líder and Anfitrión (one person each).
- The reunión page shows a **Responsables** box with who holds each tag. Roles are defined in `server/src/gatheringRoles.js` (and mirrored in `client/src/gatherings.js`).
- **Adding people:** search by name and filter by section (the reunión's own section is selected by default). Only names, section and status are shown to leaders, never phone or address. "Registrar persona nueva" creates the person and adds them (as a visita in a casa de paz).
- **Admins** see every section. The numbers live on the **Dashboard**, not on the Reuniones page: **Reuniones de esta semana** (Monday to Sunday: how many células and casas de paz, how many people, by section). Leaders don't see those numbers, only the reuniones of their own section. A section with no casas de paz is flagged **Sin casas de paz**, and one with fewer than half of the most active section is **Atrasada** (`gatheringStats.js`).
- Everything is recorded in **Actividad** under Reuniones.

## Sign-in protection and security

- **Lockout:** after 4 wrong passwords the sign-in screen warns that the account may be locked and says how many tries are left. After 6, the account is locked for 10 minutes (even the right password is refused while locked). The counter resets after a successful sign-in or when the lock expires.
- **Lifting a lock:** an admin resetting the user's password lifts it immediately (Usuarios shows "Bloqueado hasta ..."). If the locked account is the only admin, run `npm run unlock -- correo-o-usuario` in `server`.
- **Names that don't exist** get the same warnings and "locks", so the messages can't reveal which usernames exist. There is also a brake of 30 failed sign-ins per 15 minutes from one connection.
- **Sessions:** changing or resetting a password signs out that account's other sessions (the device that changed it stays in). Deactivating a user takes effect on their next request.
- **`JWT_SECRET`** must be at least 32 random characters, or the API refuses to start. Generate one: `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`.
- Use HTTPS when hosted, never commit `.env` (a `.gitignore` is included), and run `npm audit` now and then.

## Activity log (admin only: **Actividad**)

A page that shows who did what, when, from which device, and from which IP address. It can be filtered by user, type of activity, date range, and a text search.

- **What is recorded:** sign-ins, failed sign-ins and sign-outs; changes to people (which fields changed); attendance taken; every Escuela de Vida change (groups, enrollments, completed / dropped status, teacher assignments); user changes (created, role, activated or deactivated, password reset); changes to your own account; and goal changes.
- **Passwords are never stored.** The log only says, for example, "María cambió su contraseña" or "restableció la contraseña de Juan". Request bodies are never logged. A failed sign-in does not store what was typed, because it could be a password typed in the wrong box.
- **Personal data is kept out too.** Edits to a person list only the names of the fields that changed (for example "teléfono, dirección"), not the values. Status and section changes show old and new values.
- **Taps are merged.** Marking attendance or homework creates one entry per person, place and 3-hour window ("tomó asistencia del domingo 18 de octubre: 42 marcados presentes"), not one entry per tap.
- **Device** is read from the browser ("iPhone · Safari", "Windows · Chrome"). It is approximate. The app sends a small hint so iPads in desktop mode show as iPad.
- **IP address:** in development the Vite proxy forwards each visitor's real address to the API (`xfwd`), and the API reads it (`trust proxy` defaults to `loopback`). On your own computer you will still see `::1` / `127.0.0.1`, which means "this computer"; a phone or iPad shows its Wi-Fi address (like `192.168.1.40`). When hosted behind a proxy (Render, Railway, nginx), set `TRUST_PROXY=1` in `server/.env`, or every entry will show the proxy's address.
- **Retention:** entries are deleted automatically after 365 days (`ACTIVITY_RETENTION_DAYS` in `server/.env`).
- Tell your team that activity is logged.

## API summary

| Route | Who | What |
|---|---|---|
| `POST /api/auth/login` (`identifier`, `password`), `GET /api/auth/me` | all | Log in with email or username |
| `GET /api/auth/username-available`, `PUT /api/auth/profile`, `POST /api/auth/change-password` | all | Own account |
| `GET/POST /api/users`, `PUT /api/users/:id`, `POST /api/users/:id/reset-password` | admin | Manage users |
| `/api/people`, `/api/attendance` | admin, usuario | People and Sunday attendance |
| `/api/stats`, `/api/settings` | admin | Dashboard, missing list, goal |
| `GET /api/activity` | admin | Activity log (filters: `category`, `actor`, `q`, `from`, `to`, `page`) |
| `/api/escuela/*` | admin, profesor (own groups only) | Groups, enrollments, classes, records, progress |
