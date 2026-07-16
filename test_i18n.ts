import assert from 'node:assert/strict';
import './src/i18n';
import en from './src/i18n/resources/en';
import vi from './src/i18n/resources/vi';
import {
  detectLanguage,
  fixedT,
  formatCalendarSlotStatus,
  formatCalendarSlotType,
  formatCurrency,
  formatDate,
  formatFightMethod,
  formatFighterStyle,
  formatNumber,
  formatReadiness,
  formatTitleFightType,
  formatTournamentStatus,
  formatWeightClass,
  localeFor,
  readLanguage,
  writeLanguage
} from './src/lib/localization';

const flattenKeys = (value: object, prefix = ''): string[] => Object.entries(value).flatMap(([key, child]) => {
  const path = prefix ? `${prefix}.${key}` : key;
  return typeof child === 'object' && child !== null ? flattenKeys(child, path) : [path];
}).sort();

assert.equal(detectLanguage(['vi-VN', 'en-US']), 'vi');
assert.equal(detectLanguage(['fr-FR', 'en-US']), 'en');
assert.equal(detectLanguage(undefined), 'en');
assert.equal(readLanguage({ getItem: () => 'vi' }, ['en-US']), 'vi');
assert.equal(readLanguage({ getItem: () => 'invalid' }, ['vi-VN']), 'vi');
assert.equal(readLanguage({ getItem: () => { throw new Error('blocked'); } }, ['vi-VN']), 'vi');
assert.doesNotThrow(() => writeLanguage('vi', { setItem: () => { throw new Error('blocked'); } }));
assert.equal(localeFor('en'), 'en-US');
assert.equal(localeFor('vi'), 'vi-VN');
assert.equal(fixedT('en')($ => $.common.save), 'Save');
assert.equal(fixedT('vi')($ => $.common.save), 'Lưu');
assert.equal(fixedT('fr' as never)($ => $.common.save), 'Save');
assert.notEqual(fixedT('en')($ => $.fight.method.submission), fixedT('vi')($ => $.fight.method.submission));
assert.deepEqual(flattenKeys(en), flattenKeys(vi));
assert.equal(formatFightMethod('Unanimous Decision', 'vi'), 'Quyết định đồng thuận');
assert.equal(formatWeightClass('Lightweight', 'vi'), 'Hạng nhẹ');
assert.equal(formatFighterStyle('Balanced', 'vi'), 'Toàn diện');
assert.equal(formatTournamentStatus('active', 'vi'), 'Đang diễn ra');
assert.equal(formatTitleFightType('unification', 'vi'), 'Trận thống nhất đai');
assert.equal(formatReadiness('ready', 'vi'), 'Sẵn sàng');
assert.equal(formatCalendarSlotType('grand_prix_round', 'vi'), 'Vòng Grand Prix');
assert.equal(formatCalendarSlotStatus('scheduled', 'vi'), 'Đã xếp lịch');
assert.equal(formatCalendarSlotType('unknown', 'vi'), 'unknown');
assert.equal(fixedT('vi')($ => $.inbox.review), 'Xem xét');
assert.equal(fixedT('vi')($ => $.rankings.pendingDefense), 'Sắp đến hạn bảo vệ đai');
assert.equal(fixedT('vi')($ => $.mmaGuide.sections.fightResults.entries.submission.term), 'Khóa siết');
assert.equal(formatReadiness('unknown', 'vi'), 'unknown');
assert.match(formatCurrency(1_250_000, 'vi'), /1[.\s]250[.\s]000/);
assert.equal(formatNumber(1234, 'en'), '1,234');
assert.ok(formatDate('2026-07-16', 'vi').length > 0);

console.log('i18n contracts passed.');
