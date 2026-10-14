# Student Project Tracker

A hands-on web development workshop project for managing engineering project ideas. Users can add, view, edit and delete projects. Project records are stored locally in SQLite.

## Run

Use Node.js 22.18.0 or newer.

Open PowerShell in the project folder and run:

```powershell
npm.cmd ci
npm.cmd start
```

Open http://localhost:3000 in your browser. Keep the server terminal running. Stop the server with Ctrl+C.

## Files

* `public/index.html`: Page structure and form.
* `public/style.css`: Styling and responsive layout.
* `public/script.js`: Form handling, API requests and rendering.
* `server.js`: Starts the local server.
* `project-api.js`: API routes and input validation.
* `database.js`: SQLite database operations.

## Storage and Data Persistence

Project records are stored in the local SQLite database at `data/projects.db`.

Refreshing the browser or restarting the server should preserve saved SQLite records. Browser data previously stored in localStorage is not automatically migrated to SQLite.

## Verification

* CRUD operations: Create, read, update and delete tested.
* Restart persistence: Saved records remained after restarting the server.
* Failure and retry: Saving failed while the server was stopped and worked after restarting it.
* GitHub: Source code committed and pushed.
* Mobile/responsive test: Not yet verified.
* Automated tests: Run `npm.cmd test` to verify CRUD, validation, persistence and static frontend behavior.

## API

* `GET /api/health`: Check server health.
* `GET /api/projects`: List projects.
* `POST /api/projects`: Create a project.
* `PUT /api/projects/:id`: Update a project.
* `DELETE /api/projects/:id`: Delete a project.

## Limitations

This is a local learning project without login or user isolation. Users connected to the same server share its project collection.

The generated database file and `node_modules` folder should remain local and must not be committed to GitHub.
