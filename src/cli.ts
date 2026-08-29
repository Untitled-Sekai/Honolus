#!/usr/bin/env node
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { migrateDatabase, readFixture, seedDatabase } from './fixtures';
import type { Honolus } from './index';

async function main(argv: string[]): Promise<void> {
    const [command, action, ...rest] = argv;
    if (command === 'generate' && action === 'project') return generateProject(rest[0] ?? '.');
    if (command === 'generate' && action === 'route') return generateRoute(rest[0] ?? 'example', rest[1] ?? '.');
    if (command === 'routes') return printManifest(rest, false);
    if (command === 'openapi') return printManifest(rest, true);
    if (command === 'db' && action === 'migrate') return runDatabaseCommand(rest, 'migrate');
    if (command === 'db' && action === 'seed') return runDatabaseCommand(rest, 'seed');
    throw new Error(usage());
}

async function generateProject(directory: string): Promise<void> {
    const root = resolve(directory);
    await mkdir(join(root, 'src'), { recursive: true });
    await writeIfMissing(join(root, 'src/app.ts'), `import { Honolus } from '@untitledsekai/honolus'\n\nexport const sonolus = new Honolus()\nexport default sonolus.getApp()\n`);
    await writeIfMissing(join(root, 'package.json'), JSON.stringify({ type: 'module', scripts: { build: 'tsc', dev: 'tsx src/app.ts', routes: 'honolus routes --module ./dist/app.js' }, dependencies: { '@untitledsekai/honolus': '^1.0.0', hono: '^4.13.0' }, devDependencies: { typescript: '^5.0.0', tsx: '^4.0.0' } }, null, 2) + '\n');
    await writeIfMissing(join(root, 'tsconfig.json'), JSON.stringify({ compilerOptions: { target: 'ES2022', module: 'NodeNext', moduleResolution: 'NodeNext', strict: true, outDir: 'dist' }, include: ['src'] }, null, 2) + '\n');
    await writeIfMissing(join(root, 'docker-compose.yml'), `services:\n  postgres:\n    image: postgres:16\n    environment:\n      POSTGRES_PASSWORD: honolus\n      POSTGRES_DB: honolus\n    ports: ["5432:5432"]\n  redis:\n    image: redis:7\n    ports: ["6379:6379"]\n`);
    console.log(`Created Honolus project in ${root}`);
}

async function generateRoute(name: string, directory: string): Promise<void> {
    const safeName = name.replace(/[^A-Za-z0-9_-]/g, '-');
    const target = join(resolve(directory), 'src', 'routes', `${safeName}.ts`);
    await mkdir(dirname(target), { recursive: true });
    await writeIfMissing(target, `import { Honolus, SonolusContext } from '@untitledsekai/honolus'\n\nexport function register${toPascal(safeName)}(sonolus: Honolus) {\n    sonolus.route.server.info(class ${toPascal(safeName)}Handler {\n        async handle(_context: SonolusContext) {\n            return { sections: [] }\n        }\n    })\n}\n`);
    console.log(`Created ${target}`);
}

async function printManifest(args: string[], openapi: boolean): Promise<void> {
    const modulePath = option(args, '--module');
    const mod = await import(pathToFileURL(resolve(modulePath)).href) as Record<string, unknown>;
    const app = (mod.sonolus ?? mod.default ?? mod.app) as Honolus | undefined;
    if (!app || typeof (app as Honolus).getRouteManifest !== 'function') throw new Error('Module must export a Honolus instance as sonolus, app, or default');
    const value = openapi ? app.getOpenApiDocument({ title: option(args, '--title', false), version: option(args, '--version', false) }) : app.getRouteManifest();
    const output = option(args, '--output', false);
    const text = `${JSON.stringify(value, null, 2)}\n`;
    if (output) await writeFile(resolve(output), text, 'utf8'); else process.stdout.write(text);
}

async function runDatabaseCommand(args: string[], action: 'migrate' | 'seed'): Promise<void> {
    const modulePath = option(args, '--module');
    const mod = await import(pathToFileURL(resolve(modulePath)).href) as Record<string, unknown>;
    const database = mod.database as Parameters<typeof migrateDatabase>[0] | undefined;
    if (!database) throw new Error('Module must export database');
    if (action === 'migrate') await migrateDatabase(database);
    else console.log(`Seeded ${await seedDatabase(database, await readFixture(resolve(option(args, '--fixture'))))} items`);
    await database.close();
}

function option(args: string[], name: string, required = true): string {
    const index = args.indexOf(name);
    const value = index >= 0 ? args[index + 1] : undefined;
    if (required && !value) throw new Error(`Missing ${name}`);
    return value ?? '';
}

async function writeIfMissing(path: string, content: string): Promise<void> {
    try { await readFile(path); }
    catch { await writeFile(path, content, 'utf8'); }
}

function toPascal(value: string): string { return value.split(/[-_]/).map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(''); }
function usage(): string { return 'Usage: honolus generate project [dir] | generate route <name> [dir] | routes --module <file> | openapi --module <file> | db migrate --module <file> | db seed --module <file> --fixture <file>'; }

void main(process.argv.slice(2)).catch((error) => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; });
