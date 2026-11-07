import {defineConfig} from '@playwright/test';
export default defineConfig({
 testDir:'./tests/e2e',fullyParallel:false,workers:2,timeout:30000,
 reporter:[['list'],['html',{open:'never'}]],
 use:{baseURL:'http://127.0.0.1:8787',trace:'retain-on-failure',screenshot:'only-on-failure'},
 projects:[[1920,1080],[1366,768],[768,1024],[390,844]].map(([width,height])=>({name:String(width),use:{viewport:{width,height}}})),
 webServer:{command:'npm run dev -- --port 8787',url:'http://127.0.0.1:8787',reuseExistingServer:!process.env.CI,timeout:60000,
  env:{WRANGLER_LOG_PATH:'test-results/wrangler',WRANGLER_SEND_METRICS:'false'}},
});
