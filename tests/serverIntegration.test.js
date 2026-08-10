import { afterEach, describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';

const temporaryDirectories = [];

afterEach(() => {
    while (temporaryDirectories.length > 0) {
        rmSync(temporaryDirectories.pop(), { recursive: true, force: true });
    }
});

describe('server application', () => {
    it('serves critical routes with optional production features disabled', () => {
        const root = mkdtempSync(path.join(tmpdir(), 'butzcraft-server-'));
        temporaryDirectories.push(root);
        const probe = spawnSync(process.execPath, ['-e', `
            const { createApp } = require('./server.js');
            if (typeof createApp !== 'function') process.exit(2);
            (async () => {
                const runtime = createApp();
                const server = runtime.app.listen(0, '127.0.0.1');
                await new Promise((resolve, reject) => {
                    server.once('listening', resolve);
                    server.once('error', reject);
                });
                const port = server.address().port;
                const request = (pathname, options) => fetch('http://127.0.0.1:' + port + pathname, options);
                const health = await request('/health');
                const admin = await request('/api/admin/session');
                const saves = await request('/api/saves');
                const website = await new Promise((resolve, reject) => {
                    const websiteRequest = require('node:http').get({
                        hostname: '127.0.0.1',
                        port,
                        path: '/index.html',
                        headers: { Host: 'butzcraft.test' }
                    }, response => {
                        response.resume();
                        response.once('end', () => resolve({
                            status: response.statusCode,
                            location: response.headers.location || null
                        }));
                    });
                    websiteRequest.once('error', reject);
                });
                const result = {
                    health: { status: health.status, body: await health.json() },
                    admin: { status: admin.status, body: await admin.json() },
                    saves: { status: saves.status, body: await saves.json() },
                    website
                };
                await new Promise(resolve => server.close(resolve));
                runtime.close();
                console.log(JSON.stringify(result));
            })().catch(error => {
                console.error(error);
                process.exitCode = 1;
            });
        `], {
            cwd: process.cwd(),
            encoding: 'utf8',
            timeout: 10000,
            env: {
                ...process.env,
                NODE_ENV: 'production',
                HOST: '0.0.0.0',
                PORT: '0',
                ENABLE_REMOTE_SAVES: 'false',
                SITE_ADMIN_PASSWORD: '',
                SITE_CONTENT_DIR: path.join(root, 'site-content'),
                STATISTICS_DIR: path.join(root, 'statistics'),
                SAVES_DIR: path.join(root, 'saves'),
                WEBSITE_HOSTS: 'butzcraft.test',
                GAME_ORIGIN: 'https://play.butzcraft.test/'
            }
        });

        expect(probe.status, probe.stderr).toBe(0);
        expect(JSON.parse(probe.stdout.trim().split(/\r?\n/).at(-1))).toEqual({
            health: { status: 200, body: { status: 'ok' } },
            admin: { status: 503, body: { error: 'Der Adminmodus ist auf dem Server noch nicht aktiviert.' } },
            saves: { status: 503, body: { error: 'Remote saves are not enabled' } },
            website: { status: 302, location: 'https://play.butzcraft.test/' }
        });
    });

    it('keeps the IPv4 localhost server available when the IPv6 listener cannot bind', async () => {
        const root = mkdtempSync(path.join(tmpdir(), 'butzcraft-server-'));
        temporaryDirectories.push(root);
        const ipv6Blocker = createServer();
        await new Promise((resolve, reject) => {
            ipv6Blocker.once('error', reject);
            ipv6Blocker.listen(0, '::1', resolve);
        });
        const port = ipv6Blocker.address().port;
        const child = spawn(process.execPath, ['-e', `
            const { createApp, startServer } = require('./server.js');
            startServer(createApp({
                env: {
                    ...process.env,
                    NODE_ENV: 'production',
                    HOST: '127.0.0.1',
                    PORT: '${port}',
                    ENABLE_REMOTE_SAVES: 'false',
                    SITE_ADMIN_PASSWORD: '',
                    SITE_CONTENT_DIR: ${JSON.stringify(path.join(root, 'site-content'))},
                    STATISTICS_DIR: ${JSON.stringify(path.join(root, 'statistics'))},
                    SAVES_DIR: ${JSON.stringify(path.join(root, 'saves'))}
                }
            }));
        `], {
            cwd: process.cwd(),
            stdio: ['ignore', 'pipe', 'pipe']
        });
        let stderr = '';
        child.stderr.setEncoding('utf8');
        child.stderr.on('data', chunk => {
            stderr += chunk;
        });

        try {
            let health = null;
            for (let attempt = 0; attempt < 30 && child.exitCode === null; attempt++) {
                try {
                    const response = await fetch(`http://127.0.0.1:${port}/health`);
                    health = { status: response.status, body: await response.json() };
                    break;
                } catch {
                    await new Promise(resolve => setTimeout(resolve, 100));
                }
            }
            await new Promise(resolve => setTimeout(resolve, 300));

            expect(health, stderr).toEqual({ status: 200, body: { status: 'ok' } });
            expect(child.exitCode, stderr).toBeNull();
        } finally {
            if (child.exitCode === null) {
                child.kill();
                await new Promise(resolve => child.once('exit', resolve));
            }
            await new Promise(resolve => ipv6Blocker.close(resolve));
        }
    });
});
