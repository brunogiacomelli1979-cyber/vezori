import {mkdir,copyFile,writeFile,readFile} from 'node:fs/promises';
await mkdir('public/vendor',{recursive:true});
for(const [source,dest] of [
 ['node_modules/chart.js/dist/chart.umd.js','chart.js'],
 ['node_modules/chart.js/LICENSE.md','chartjs-LICENSE.txt'],
 ['node_modules/lightweight-charts/dist/lightweight-charts.standalone.production.js','lightweight-charts.js'],
 ['node_modules/lightweight-charts/LICENSE','lightweight-charts-LICENSE.txt']
])await copyFile(source,'public/vendor/'+dest);
await writeFile('public/vendor/NOTICE.txt','TradingView Lightweight Charts™\nCopyright (c) 2025 TradingView, Inc. https://www.tradingview.com/\n\nIncludes tslib, Copyright (c) Microsoft Corporation, BSD Zero Clause.\n'+await readFile('node_modules/chart.js/LICENSE.md','utf8'));
console.log('Local chart assets prepared from pinned npm packages; licenses retained.');
