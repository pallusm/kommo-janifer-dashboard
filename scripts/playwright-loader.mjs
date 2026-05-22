import { createRequire } from 'node:module';

const BUNDLED_NODE_MODULES = '/Users/pallusmassucci/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules';

export function loadPlaywright() {
  const localRequire = createRequire(import.meta.url);

  try {
    return localRequire('playwright');
  } catch {
    const bundledRequire = createRequire(`${BUNDLED_NODE_MODULES}/`);
    return bundledRequire('playwright');
  }
}
