import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const requestedTarget = process.argv[2] ?? 'all';
const targets = requestedTarget === 'all' ? ['firefox', 'chromium'] : [requestedTarget];
const vite = resolve(root, 'node_modules/.bin/vite');

function originFrom(value, label) {
  const url = new URL(value);
  if (
    !['http:', 'https:'].includes(url.protocol) ||
    url.pathname !== '/' ||
    url.search ||
    url.hash
  ) {
    throw new Error(`${label} must be an http(s) origin, for example https://example.invalid`);
  }
  return url.origin;
}

function replaceTokens(value, tokens) {
  if (typeof value === 'string') {
    return Object.entries(tokens).reduce(
      (result, [token, replacement]) => result.replaceAll(token, replacement),
      value,
    );
  }
  if (Array.isArray(value)) return value.map((item) => replaceTokens(item, tokens));
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, replaceTokens(item, tokens)]),
    );
  }
  return value;
}

function build(target) {
  if (!['firefox', 'chromium'].includes(target)) throw new Error(`Unknown target: ${target}`);
  const siteOrigin = originFrom(
    process.env.DW_SITE_ORIGIN ?? 'https://fetlife.com',
    'DW_SITE_ORIGIN',
  );
  const apiOrigin = new URL(process.env.DW_API_URL ?? 'http://localhost:18080').origin;
  const output = resolve(root, `dist/${target}`);
  execFileSync(vite, ['build', '--mode', 'debug'], {
    cwd: root,
    stdio: 'inherit',
    env: { ...process.env, BROWSER_TARGET: target },
  });
  execFileSync(vite, ['build', '--mode', 'debug'], {
    cwd: root,
    stdio: 'inherit',
    env: { ...process.env, BROWSER_TARGET: target, BUILD_EXTENSION_CONTENT: 'true' },
  });

  const builtPopup = resolve(output, 'src/popup/index.html');
  const manifestPopup = resolve(output, 'popup/index.html');
  if (existsSync(builtPopup)) {
    mkdirSync(dirname(manifestPopup), { recursive: true });
    renameSync(builtPopup, manifestPopup);
  }

  const base = JSON.parse(readFileSync(resolve(root, 'manifests/base.json'), 'utf8'));
  const specific = JSON.parse(readFileSync(resolve(root, `manifests/${target}.json`), 'utf8'));
  const manifest = replaceTokens(
    { ...base, ...specific },
    {
      __SITE_ORIGIN__: siteOrigin,
      __API_ORIGIN__: apiOrigin,
    },
  );
  if (apiOrigin.startsWith('http://localhost:') || apiOrigin.startsWith('http://127.0.0.1:')) {
    const apiUrl = new URL(apiOrigin);
    const port = apiUrl.port ? `:${apiUrl.port}` : '';
    const localAliases = [`http://localhost${port}/*`, `http://127.0.0.1${port}/*`];
    manifest.host_permissions = [...new Set([...manifest.host_permissions, ...localAliases])];
  }
  mkdirSync(output, { recursive: true });
  writeFileSync(resolve(output, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
}

for (const target of targets) build(target);
