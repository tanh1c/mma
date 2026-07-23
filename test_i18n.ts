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
assert.equal(fixedT('en')($ => $.generated.drama.decisionTitle), 'Backstage decision');
assert.equal(fixedT('vi')($ => $.generated.drama.decisionBody, { fighter: 'Nguyen An', response: 'hold_line' }), 'Nguyen An: ban tổ chức đã chọn phương án hold_line.');
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
assert.equal(fixedT('en')($ => $.navigation.leagues), 'Leagues');
assert.equal(fixedT('en')($ => $.navigation.contractMarket), 'Contract Market');
assert.equal(fixedT('en')($ => $.navigation.promotionFinances), 'Promotion Finances');
assert.equal(fixedT('en')($ => $.contractMarket.tabs.available), 'Available');
assert.equal(fixedT('en')($ => $.promotionFinances.modes.recovery), 'Recovery');
assert.equal(fixedT('vi')($ => $.navigation.leagues), 'Hệ thống giải');
assert.equal(fixedT('vi')($ => $.navigation.contractMarket), 'Thị trường hợp đồng');
assert.equal(fixedT('vi')($ => $.navigation.promotionFinances), 'Tài chính giải đấu');
assert.equal(fixedT('vi')($ => $.contractMarket.tabs.available), 'Có thể ký');
assert.equal(fixedT('vi')($ => $.promotionFinances.reasons.success), 'Đã hoàn tất đầu tư thương hiệu.');
assert.ok(flattenKeys(en).includes('contractMarket.reasons.outbid')); assert.ok(flattenKeys(vi).includes('contractMarket.reasons.outbid'));
assert.equal(fixedT('en')($ => $.leagues.championsCupQualification), 'Champions Cup Qualification');
assert.equal(fixedT('vi')($ => $.leagues.challengeCupQualification), 'Suất Challenge Cup');
assert.equal(fixedT('en')($ => $.tournaments.international), 'International');
assert.equal(fixedT('vi')($ => $.tournaments.domestic), 'Quốc nội');
assert.equal(fixedT('vi')($ => $.mmaGuide.sections.fightResults.entries.submission.term), 'Khóa siết');
assert.equal(fixedT('vi')($ => $.dramaTimeline.rationaleFactors.cashSafety), 'Bảo toàn tiền mặt');
assert.equal(fixedT('vi')($ => $.dramaTimeline.consequences.socialHype), 'Sức nóng mạng xã hội');
assert.equal(fixedT('vi')($ => $.generated.objectives.reward, { kind: 'Lợi nhuận' }), 'Hoàn thành mục tiêu mùa giải: Lợi nhuận');
assert.equal(formatReadiness('unknown', 'vi'), 'unknown');
assert.match(formatCurrency(1_250_000, 'vi'), /1[.\s]250[.\s]000/);
assert.equal(formatNumber(1234, 'en'), '1,234');
assert.ok(formatDate('2026-07-16', 'vi').length > 0);

console.log('i18n contracts passed.');
