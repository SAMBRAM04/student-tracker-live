import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const projectDirectory = fileURLToPath(new URL('..', import.meta.url));
const delay = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));

async function getAvailablePort() {
  const probe = createServer();
  await new Promise((resolve, reject) => {
    probe.once('error', reject);
    probe.listen(0, '127.0.0.1', resolve);
  });
  const { port } = probe.address();
  await new Promise((resolve, reject) => probe.close(error => error ? reject(error) : resolve()));
  return port;
}

test('website server supports CRUD, validation, persistence and static assets', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'student-tracker-test-'));
  const databaseFile = join(directory, 'projects.db');
  const port = await getAvailablePort();
  const baseUrl = `http://127.0.0.1:${port}`;
  let server;
  let output = '';

  async function startServer() {
    server = spawn(process.execPath, ['server.js'], {
      cwd: projectDirectory,
      env: { ...process.env, PORT: String(port), DB_FILE: databaseFile },
      stdio: ['ignore', 'pipe', 'pipe']
    });
    server.stdout.setEncoding('utf8').on('data', chunk => { output += chunk; });
    server.stderr.setEncoding('utf8').on('data', chunk => { output += chunk; });

    for (let attempt = 0; attempt < 100; attempt++) {
      if (server.exitCode !== null) {
        throw new Error(`Server exited before becoming ready.\n${output}`);
      }
      try {
        const response = await fetch(`${baseUrl}/api/health`);
        if (response.ok) return;
      } catch {
        await delay(50);
      }
    }

    throw new Error(`Server did not start.\n${output}`);
  }

  async function stopServer() {
    if (!server || server.exitCode !== null) return;
    await new Promise((resolve, reject) => {
      server.once('error', reject);
      server.once('exit', resolve);
      server.kill();
    });
  }

  const request = (url, method, body) => fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });

  try {
    await startServer();

    assert.deepEqual(await (await fetch(`${baseUrl}/api/health`)).json(), { ok: true });
    assert.match(await (await fetch(`${baseUrl}/`)).text(), /Student Project Tracker/);
    assert.equal((await fetch(`${baseUrl}/style.css`)).status, 200);
    assert.equal((await fetch(`${baseUrl}/script.js`)).status, 200);
    assert.deepEqual(await (await fetch(`${baseUrl}/api/projects`)).json(), []);

    assert.equal((await request(`${baseUrl}/api/projects`, 'POST', { name: ' ', status: 'Planned' })).status, 400);
    assert.equal((await request(`${baseUrl}/api/projects`, 'POST', { name: 'Project', status: 'Unknown' })).status, 400);
    assert.equal((await request(`${baseUrl}/api/projects`, 'POST', { name: 'x'.repeat(81), status: 'Planned' })).status, 400);

    const createResponse = await request(`${baseUrl}/api/projects`, 'POST', {
      name: "  IoT Monitor's test  ",
      status: 'Planned'
    });
    assert.equal(createResponse.status, 201);
    const project = await createResponse.json();
    assert.equal(project.name, "IoT Monitor's test");

    const updateResponse = await request(`${baseUrl}/api/projects/${project.id}`, 'PUT', {
      name: 'Smart Home',
      status: 'Completed'
    });
    assert.equal((await updateResponse.json()).status, 'Completed');

    await stopServer();
    await startServer();

    assert.equal((await (await fetch(`${baseUrl}/api/projects`)).json())[0].name, 'Smart Home');
    assert.equal((await fetch(`${baseUrl}/api/projects/0`, { method: 'DELETE' })).status, 400);
    assert.equal((await request(`${baseUrl}/api/projects/999999`, 'PUT', {
      name: 'Missing',
      status: 'Planned'
    })).status, 404);
    assert.equal((await fetch(`${baseUrl}/api/projects/${project.id}`, { method: 'DELETE' })).status, 200);
    assert.equal((await fetch(`${baseUrl}/api/projects/${project.id}`, { method: 'DELETE' })).status, 404);
    assert.equal((await fetch(`${baseUrl}/api/projects`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{'
    })).status, 400);
    assert.equal((await fetch(`${baseUrl}/api/unknown`)).status, 404);
  } finally {
    await stopServer();
    rmSync(directory, { recursive: true, force: true });
  }
});
