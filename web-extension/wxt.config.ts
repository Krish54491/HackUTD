import { defineConfig } from 'wxt';

declare const process: { env: Record<string, string | undefined> };
const STDB_HOST = process.env.WXT_SPACETIME_HOST ?? 'https://maincloud.spacetimedb.com';

// See https://wxt.dev/api/config.html
export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  manifest: {
    name: 'Tango',
    description: 'Flags scam and phishing websites, and hides fake job, scholarship and rental listings.',
    permissions: ['storage', 'activeTab', 'offscreen'],
    host_permissions: [`${new URL(STDB_HOST).origin}/*`],
    action: { default_title: 'Tango' },
    web_accessible_resources: [{ resources: ['characters/*.png', 'tango/*.png'], matches: ['<all_urls>'] }],
  },
});
