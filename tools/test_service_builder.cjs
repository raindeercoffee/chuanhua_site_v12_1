'use strict';

// 不需安裝套件。從專案資料夾執行：node tools/test_service_builder.cjs
// 直接呼叫網站使用的模型；畫面與手指拖曳仍由瀏覽器驗收。
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ROOT = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const source = fs.readFileSync(path.join(ROOT, 'assets/service-builder.js'), 'utf8');
const sandbox = { console, setTimeout, clearTimeout };
vm.createContext(sandbox);
vm.runInContext(source, sandbox, { filename: 'service-builder.js' });
const api = sandbox.CHBuild;
assert.ok(api, '網站應提供可在沒有畫面時測試的生產模型');
const copy = value => JSON.parse(JSON.stringify(value));
let checks = 0;
function check(name, fn) {
  try { fn(); checks += 1; console.log(`通過：${name}`); }
  catch (error) { error.message = `${name}：${error.message}`; throw error; }
}

// 這是開工時存在的全部產生頁。新增積木頁不可刪掉任何一頁。
const previousPaths = [
  '/about/', '/ai/consulting/', '/ai/content/', '/ai/demo/', '/ai/',
  '/ai/quote/', '/ai/tools/', '/ai/website/', '/ai/workflow/', '/cases/',
  '/contact/', '/courses/', '/home/', '/notes/ai-ad-copy-brand-voice/',
  '/notes/ai-ad-upload-automation/', '/notes/ai-custom-tool-pricing-guide/',
  '/notes/ai-image-video-commercial-use/', '/notes/ai-receipt-photo-bookkeeping/',
  '/notes/', '/notes/no-code-marketing-automation/', '/notes/sme-ai-adoption-5-questions/',
  '/policy/', '/quiz/', '/resonance/', '/services/', '/studio/flow/', '/studio/', '/team/'
];

check('舊網址全數保留，新網址使用既有布幕', () => {
  const block = html.match(/<script type="application\/json" id="route-meta">([\s\S]*?)<\/script>/);
  assert.ok(block, '應有網址資料表');
  const routes = JSON.parse(block[1]);
  assert.ok(routes['/']);
  for (const route of previousPaths) {
    assert.ok(routes[route], `缺少 ${route}`);
    assert.ok(fs.existsSync(path.join(ROOT, route, 'index.html')), `未產生 ${route}`);
  }
  assert.equal(routes['/build/'].layer, 'feature');
  assert.equal(routes['/build/'].feature, 'build');
  assert.ok(fs.existsSync(path.join(ROOT, 'build/index.html')), '未產生 /build/');
  assert.match(html, /data-feature="build"/);
  assert.match(html, /id="feature-build-title"/);
});

check('頁面容器與兩處入口齊全', () => {
  for (const id of ['ch-builder', 'ch-scenarios', 'ch-active-list', 'ch-removed-list',
    'ch-details', 'ch-summary', 'ch-announcement', 'ch-price-editor', 'ch-price-gear']) {
    assert.match(html, new RegExp(`id="${id}"`), `缺少 ${id}`);
  }
  assert.ok((html.match(/>排排看・算算看 →<\/a>/g) || []).length >= 2, '服務與 AI 頁皆應有入口');
  assert.match(html, /assets\/service-builder\.css/);
  assert.match(html, /assets\/service-builder\.js/);
});

// 下方是金額與狀態測試，刻意使用正式程式的公開函數。
function selection(ids) {
  const state = api.createState();
  for (const id of [...state.active]) if (!ids.includes(id)) api.removeService(state, id);
  ids.forEach((id, index) => api.moveService(state, id, index));
  return state;
}
function freshPricing() { return copy(api.DEFAULT_PRICING); }
function totalFor(ids, pricing = freshPricing()) { return api.calculate(selection(ids), pricing); }

check('八項服務基本級距都由 49,000 起，預設金額正確', () => {
  assert.equal(api.SERVICES.length, 8);
  for (const service of api.SERVICES) {
    const prices = api.DEFAULT_PRICING.services[service.id];
    assert.equal(prices.tiers.basic, 49000, service.name);
    assert.ok(service.addons.length >= 4 && service.addons.length <= 6, `${service.name} 應有四至六塊積木`);
    for (const addon of service.addons) assert.equal(typeof prices.addons[addon.id], 'number');
  }
  const result = api.calculate(api.createState(), freshPricing());
  assert.equal(result.rawSubtotal, 392000);
  assert.equal(result.discountRate, 0.9);
  assert.equal(result.onceLow, 352800);
  assert.equal(result.onceHigh, 423360);
});

check('排序會改變名次與第一階段，價錢保持一致', () => {
  const state = api.createState();
  const pricing = freshPricing();
  const before = api.calculate(state, pricing).onceLow;
  api.moveService(state, 'website', 0);
  const result = api.calculate(state, pricing);
  assert.equal(state.active[0], 'website');
  assert.equal(result.breakdown[0].id, 'website');
  assert.deepEqual(Array.from(result.breakdown, entry => entry.rank), [1, 2, 3, 4, 5, 6, 7, 8]);
  assert.equal(new Set(state.active).size, 8);
  assert.equal(result.onceLow, before);
  assert.match(api.buildSummary(state, pricing), /第一階段先做：品牌官網製作/);
});

check('拿掉與加回不重複，並保留原本選過的細項', () => {
  const state = api.createState();
  api.toggleAddon(state, 'ads', 'creative', true);
  api.removeService(state, 'ads');
  api.removeService(state, 'ads');
  assert.equal(state.active.includes('ads'), false);
  assert.equal(Array.from(state.removed).filter(id => id === 'ads').length, 1);
  api.restoreService(state, 'ads', 1);
  api.restoreService(state, 'ads', 1);
  assert.equal(Array.from(state.active).filter(id => id === 'ads').length, 1);
  assert.equal(state.active[1], 'ads');
  assert.equal(state.removed.includes('ads'), false);
  const ads = api.calculate(state, freshPricing()).breakdown.find(entry => entry.id === 'ads');
  assert.equal(ads.subtotal, 61000);
});

check('情境把適合服務排到前面，保留已拿掉服務', () => {
  const state = api.createState();
  api.removeService(state, 'brand');
  assert.ok(api.selectScenario(state, 'website'));
  assert.equal(state.active[0], 'website');
  assert.equal(state.expanded, 'website');
  assert.equal(state.active.includes('brand'), false);
  assert.equal(state.removed.includes('brand'), true);
  assert.equal(new Set(state.active).size, 7);
  const ordered = copy(state.active);
  assert.equal(api.selectScenario(state, '不存在的情境'), false);
  assert.deepEqual(copy(state.active), ordered);
});

check('級距、加購與數量使用同一個正式加總公式', () => {
  const state = selection(['ads']);
  const pricing = freshPricing();
  api.setTier(state, 'ads', 'advanced');
  assert.equal(api.calculate(state, pricing).onceLow, 69000);
  api.setTier(state, 'ads', 'complete');
  assert.equal(api.calculate(state, pricing).onceLow, 99000);
  api.setTier(state, 'ads', 'basic');
  api.toggleAddon(state, 'ads', 'creative', true);
  api.toggleAddon(state, 'ads', 'pixel', true);
  assert.equal(api.calculate(state, pricing).onceLow, 67000);
  api.toggleAddon(state, 'ads', 'creative', false);
  assert.equal(api.calculate(state, pricing).onceLow, 55000);
  api.setQuantity(state, 'ads', 3);
  const result = api.calculate(state, pricing);
  assert.equal(result.breakdown[0].quantityCost, 36000);
  assert.equal(result.onceLow, 91000);
  assert.equal(result.onceHigh, 109200);
});

check('兩項九五折、三項九折，關掉優惠恢復原價', () => {
  const pricing = freshPricing();
  assert.equal(totalFor(['ads'], pricing).onceLow, 49000);
  let result = totalFor(['ads', 'website'], pricing);
  assert.equal(result.rawSubtotal, 98000);
  assert.equal(result.discountRate, 0.95);
  assert.equal(result.discountAmount, 4900);
  assert.equal(result.onceLow, 93100);
  result = totalFor(['ads', 'website', 'workflow'], pricing);
  assert.equal(result.discountRate, 0.9);
  assert.equal(result.onceLow, 132300);
  assert.ok(api.updatePrice(pricing, 'discount.enabled', false));
  assert.equal(totalFor(['ads', 'website', 'workflow'], pricing).onceLow, 147000);
});

check('全部拿掉為零，維護費獨立按月列出', () => {
  const state = selection([]);
  const pricing = freshPricing();
  let result = api.calculate(state, pricing);
  assert.equal(result.rawSubtotal, 0);
  assert.equal(result.onceLow, 0);
  assert.equal(result.onceHigh, 0);
  assert.equal(result.breakdown.length, 0);
  api.setMaintenance(state, 'basic');
  assert.equal(api.calculate(state, pricing).monthly, 0, '沒有選服務時不收維護費');
  api.restoreService(state, 'ads');
  assert.equal(api.calculate(state, pricing).monthly, 3000);
  api.setMaintenance(state, 'complete');
  assert.equal(api.calculate(state, pricing).monthly, 8000);
  api.setMaintenance(state, 'none');
  assert.equal(api.calculate(state, pricing).monthly, 0);
});

check('調價函數立刻改變起價、級距、積木與數量金額', () => {
  const state = selection(['ads']);
  const pricing = freshPricing();
  assert.ok(api.updatePrice(pricing, 'services.ads.tiers.basic', 59000));
  assert.equal(api.calculate(state, pricing).onceLow, 59000);
  assert.ok(api.updatePrice(pricing, ['services', 'ads', 'tiers', 'advanced'], 79000));
  api.setTier(state, 'ads', 'advanced');
  assert.equal(api.calculate(state, pricing).onceLow, 79000);
  api.toggleAddon(state, 'ads', 'creative', true);
  assert.ok(api.updatePrice(pricing, 'services.ads.addons.creative', 22000));
  assert.equal(api.calculate(state, pricing).onceLow, 101000);
  api.setQuantity(state, 'ads', 2);
  assert.ok(api.updatePrice(pricing, 'services.ads.quantityPrice', 28000));
  assert.equal(api.calculate(state, pricing).onceLow, 129000);
});

check('調價函數立刻改變折扣、區間與維護費', () => {
  const state = selection(['ads', 'website']);
  const pricing = freshPricing();
  assert.ok(api.updatePrice(pricing, 'discount.twoServices', 0.8));
  assert.equal(api.calculate(state, pricing).onceLow, 78400);
  assert.ok(api.updatePrice(pricing, 'rangeMultiplier', 1.5));
  assert.equal(api.calculate(state, pricing).onceHigh, 117600);
  assert.ok(api.updatePrice(pricing, 'maintenance.basic', 6000));
  api.setMaintenance(state, 'basic');
  assert.equal(api.calculate(state, pricing).monthly, 6000);
  api.restoreService(state, 'workflow');
  assert.ok(api.updatePrice(pricing, 'discount.threeOrMore', 0.85));
  assert.equal(api.calculate(state, pricing).onceLow, 124950);
});

check('非法調價不污染設定，恢復預設使用獨立副本', () => {
  const pricing = freshPricing();
  const before = JSON.stringify(pricing);
  for (const value of [-1, NaN, Infinity, '無效', null, [], [59000], {}, '   ']) {
    assert.equal(api.updatePrice(pricing, 'services.ads.tiers.basic', value), false, String(value));
  }
  assert.equal(api.updatePrice(pricing, 'services.unknown.tiers.basic', 1000), false);
  assert.equal(api.updatePrice(pricing, '__proto__.polluted', 1000), false);
  assert.equal(api.updatePrice(pricing, 'discount.twoServices', 1.5), false);
  assert.equal(JSON.stringify(pricing), before);
  const reset = api.resetPricing();
  assert.deepEqual(copy(reset), copy(api.DEFAULT_PRICING));
  reset.services.ads.tiers.basic = 1;
  assert.equal(api.DEFAULT_PRICING.services.ads.tiers.basic, 49000);
});

check('聊天摘要包含順位、細項、費用與示範提醒', () => {
  const state = selection(['website', 'ads']);
  const pricing = freshPricing();
  api.setTier(state, 'ads', 'advanced');
  api.toggleAddon(state, 'ads', 'creative', true);
  api.setMaintenance(state, 'basic');
  const summary = api.buildSummary(state, pricing);
  assert.match(summary, /品牌官網製作/);
  assert.match(summary, /數位廣告投放/);
  assert.match(summary, /進階/);
  assert.match(summary, /第一階段先做：品牌官網製作/);
  assert.match(summary, /示範/);
  assert.match(summary, /3,000/);
  assert.ok(summary.includes(api.SERVICES.find(service => service.id === 'ads').addons.find(addon => addon.id === 'creative').name));
  assert.match(summary, /123,500/);
});

console.log(`共 ${checks} 組檢查通過。畫面拖曳、手機手感與剪貼簿仍須瀏覽器驗收。`);

