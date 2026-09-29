// Project-level checks that keep the app, Android build and store files in step.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');

test('app version matches package.json', () => {
  const pkg = JSON.parse(read('package.json'));
  const m = read('www/js/app.js').match(/var APP_VERSION = '([^']+)'/);
  assert.ok(m, 'APP_VERSION not found in app.js');
  assert.strictEqual(m[1], pkg.version);
});

test('privacy page is built from the current policy', () => {
  const md = read('store-listing/privacy-policy.md');
  const html = read('www/privacy.html');
  for (const h of md.match(/^## .+$/gm)) {
    const title = h.slice(3).replace(/&/g, '&amp;').replace(/'/g, '’');
    assert.ok(html.includes(h.slice(3)) || html.includes(title), 'privacy.html is missing section: ' + h + ' (run npm run privacy)');
  }
});

test('native plugin names match what platform.js calls', () => {
  const js = read('www/js/platform.js');
  const widget = read('android/app/src/main/java/com/sidequeststudio/hydrippo/widget/WidgetPlugin.kt');
  const health = read('android/app/src/main/java/com/sidequeststudio/hydrippo/health/HealthPlugin.kt');
  assert.match(widget, /@CapacitorPlugin\(name = "HydrippoWidget"\)/);
  assert.match(health, /@CapacitorPlugin\(name = "HydrippoHealth"\)/);
  for (const m of ['update', 'takePending']) {
    assert.ok(js.includes('HydrippoWidget.' + m), 'platform.js does not call HydrippoWidget.' + m);
    assert.match(widget, new RegExp('@PluginMethod\\s+fun ' + m + '\\('), 'WidgetPlugin.kt has no ' + m);
  }
  for (const m of ['availability', 'requestPermission', 'writeHydration', 'deleteHydration', 'openInstall']) {
    assert.ok(js.includes('H().' + m), 'platform.js does not call HydrippoHealth.' + m);
    assert.match(health, new RegExp('@PluginMethod\\s+fun ' + m + '\\('), 'HealthPlugin.kt has no ' + m);
  }
});

test('Android manifest declares what the features need', () => {
  const mf = read('android/app/src/main/AndroidManifest.xml');
  for (const s of ['android.permission.health.WRITE_HYDRATION', 'android.intent.action.VIEW_PERMISSION_USAGE',
    'androidx.health.ACTION_SHOW_PERMISSIONS_RATIONALE', 'android.appwidget.action.APPWIDGET_UPDATE', '.widget.WidgetActionReceiver']) {
    assert.ok(mf.includes(s), 'manifest is missing ' + s);
  }
  assert.ok(!mf.includes('READ_HYDRATION'), 'Hydrippo must not ask to read health data');
});

test('every string and drawable the widget code uses exists', () => {
  const kt = read('android/app/src/main/java/com/sidequeststudio/hydrippo/widget/HydrippoWidgetProvider.kt') +
    read('android/app/src/main/java/com/sidequeststudio/hydrippo/PrivacyActivity.kt');
  const strings = read('android/app/src/main/res/values/strings.xml');
  for (const [, name] of kt.matchAll(/R\.string\.(\w+)/g)) assert.ok(strings.includes('name="' + name + '"'), 'missing string ' + name);
  for (const [, name] of kt.matchAll(/R\.drawable\.(\w+)/g)) {
    const found = ['drawable', 'drawable-nodpi'].some((d) => ['.xml', '.png'].some((e) => fs.existsSync(path.join(root, 'android/app/src/main/res', d, name + e))));
    assert.ok(found, 'missing drawable ' + name);
  }
  for (const [, name] of kt.matchAll(/R\.color\.(\w+)/g)) assert.ok(read('android/app/src/main/res/values/colors.xml').includes('name="' + name + '"'), 'missing color ' + name);
  for (const layout of ['widget_small', 'widget_wide']) {
    const xml = read('android/app/src/main/res/layout/' + layout + '.xml');
    for (const [, id] of kt.matchAll(/R\.id\.(w_\w+)/g)) assert.ok(xml.includes('@+id/' + id), layout + ' is missing view ' + id);
  }
});
