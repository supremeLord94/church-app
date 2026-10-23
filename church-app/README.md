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

## Branding

The name, logo and colors can be changed in three places: the name in `client/src/App.jsx` and `client/src/pages/Login.jsx`, the logo files in `client/public/` (`logo.png`, `favicon.png`), and the color variables at the top of `client/src/styles.css`.

## Roles

| Role | Can do |
|---|---|
| **Administrador** | Everything: dashboard, attendance, people, Escuela de Vida (groups, students, teachers), users |
| **Usuario** | Take attendance, register new people, edit a person's info. Nothing else. |
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
- **Personas** opens the person form as a centered window. City and state are prefilled with Tijuana / BC when empty (`DEFAULT_CITY` and `DEFAULT_STATE` in `client/src/components/PersonForm.jsx`). Name and phone fields ask the browser not to autofill. Registering someone with the same first and last name as an existing person asks for confirmation first.
- **Resumen** also lists everyone with a birthday in the next 4 weeks.
- **Ausentes** lists members who missed N or more Sundays in a row. **Resumen** shows totals, a 12-week chart with the goal, and a per-section breakdown (admin only).

## Escuela de Vida

- **Courses**: ABC, Nivel 1, 2, 3. **Groups** take one course together (12 classes by default, adjustable).
- **Registrar clase**: pick the class and date, then tap **Asistió** and **Tarea** per student. The progress grid shows every class at once.
- **Student status** in a group: Activo, Completó, Se retiró. Admins and the group's teachers can change it. "Terminar grupo" (admin) marks everyone still active as completed.
- **At risk**: an active student is flagged after **3 classes in a row without attending, or 3 classes in a row without turning in homework** (`RISK = 3` in `server/src/routes/escuela.js` and `client/src/escuela.js`).
- **Stages** (admin, Alumnos tab): Terminó la escuela, En curso, Se detuvo, No ha empezado. "Registrar curso previo" records a course finished before using the app.
- **Teachers** see only "Mis grupos" and the at-risk students inside them. Only admins create groups, enroll students and assign teachers.

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
