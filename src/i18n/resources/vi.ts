import type en from './en';
import type { TranslationShape } from './en';

const vi: TranslationShape<typeof en> = {
  common: {
    save: 'Lưu',
    load: 'Tải',
    export: 'Xuất',
    import: 'Nhập',
    back: 'Quay lại',
    select: 'Chọn...',
    loading: 'Đang tải giao diện...',
    newGame: 'Game mới',
    newGameConfirm: 'Bắt đầu game mới? Tiến trình chưa lưu sẽ bị mất.',
    language: 'Ngôn ngữ',
    english: 'Tiếng Anh',
    vietnamese: 'Tiếng Việt'
  },
  navigation: {
    promotion: 'Giải đấu',
    competition: 'Thi đấu',
    records: 'Hồ sơ',
    dashboard: 'Tổng quan',
    inbox: 'Hộp thư',
    calendar: 'Lịch',
    bookEvent: 'Xếp sự kiện',
    roster: 'Đội hình',
    freeAgents: 'Ký võ sĩ',
    rankings: 'Bảng xếp hạng',
    tournaments: 'Giải Grand Prix',
    socialHub: 'Mạng xã hội',
    historyStats: 'Lịch sử & Thống kê',
    mmaGuide: 'Cẩm nang MMA',
    debugSim: 'Mô phỏng thử',
    settings: 'Cài đặt'
  },
  shell: {
    gameNavigation: 'Điều hướng game',
    promotionControl: 'Điều hành giải đấu',
    reputation: 'Danh tiếng {{value}}',
    closeNavigation: 'Đóng điều hướng',
    openNavigation: 'Mở điều hướng',
    advanceWeek: 'Qua một tuần',
    advance: 'Tiếp tục'
  },
  search: {
    placeholder: 'Tìm võ sĩ hoặc sự kiện',
    label: 'Tìm nhanh',
    fighter: 'Võ sĩ',
    event: 'Sự kiện'
  },
  settings: {
    eyebrow: 'Tùy chọn',
    title: 'Cài đặt',
    description: 'Tùy chọn hiển thị áp dụng cho tất cả bản lưu.',
    units: 'Đơn vị',
    unitsDescription: 'Chọn cách hiển thị chiều cao và cân nặng của võ sĩ.',
    metric: 'Hệ mét',
    metricDescription: 'Centimét và kilôgam',
    imperial: 'Hệ Mỹ / Anh',
    imperialDescription: 'Feet, inch và pound',
    languageDescription: 'Chọn ngôn ngữ dùng trong toàn bộ ứng dụng.',
    englishDescription: 'Dùng giao diện và nội dung game mới bằng tiếng Anh.',
    vietnameseDescription: 'Dùng giao diện và nội dung game mới bằng tiếng Việt.'
  },
  dashboard: {
    fallbackPromotion: 'Giải đấu của bạn',
    managerMode: 'Chế độ quản lý', observerMode: 'Chế độ quan sát',
    stats: { funds: 'Ngân quỹ', reputation: 'Danh tiếng', fanbase: 'Người hâm mộ', rosterSize: 'Quy mô đội hình' },
    observer: {
      title: 'Tự động / Chế độ quan sát', description: 'AI sẽ tự xếp sự kiện, ký võ sĩ tự do, gia hạn hợp đồng và sa thải võ sĩ. Hãy theo dõi thế giới MMA phát triển hoặc giành lại quyền điều khiển bất cứ lúc nào.',
      week: 'Qua 1 tuần', month: 'Qua 1 tháng', sixMonths: 'Mô phỏng nhanh 6 tháng', watchLive: 'Xem trực tiếp sự kiện', simulating: 'Đang mô phỏng thế giới...',
      summary: 'Tóm tắt mô phỏng ({{days}} ngày: {{start}} đến {{end}})', eventsBooked: 'Sự kiện đã xếp', eventsRan: 'Sự kiện đã diễn ra', fightsSimmed: 'Trận đã mô phỏng', newChamps: 'Nhà vô địch mới', moneyChange: 'Biến động tiền', reputationChange: 'Biến động danh tiếng', bookingDelays: 'Lần trì hoãn xếp lịch', emergencies: 'Tình huống khẩn cấp', cashInjected: 'đã bơm {{count}} nghìn', highlights: 'Điểm nhấn đáng chú ý', undisputedCrowned: '{{count}} nhà vô địch tuyệt đối mới', interimWon: '{{count}} danh hiệu tạm thời mới', unifications: '{{count}} trận thống nhất đai', injuries: '{{count}} chấn thương nặng', biggestProfit: 'Lợi nhuận sự kiện lớn nhất: {{amount}}', awards: 'Đã tạo giải thưởng năm', checkHistory: 'Xem Lịch sử'
    },
    actions: { title: 'Việc cần xử lý', viewAll: 'Xem tất cả' },
    nextEvent: { title: 'Sự kiện tiếp theo', simulate: 'Mô phỏng', attendance: 'Khán giả dự kiến', revenue: 'Doanh thu dự kiến', cost: 'Chi phí dự kiến', profit: 'Lợi nhuận dự kiến', versus: 'đấu', empty: 'Chưa xếp sự kiện.', book: 'Xếp sự kiện' },
    pastEvents: { title: 'Sự kiện đã qua', fights: '{{count}} trận', viewResults: 'Xem kết quả', empty: 'Chưa có sự kiện đã qua.' },
    champions: { title: 'Nhà vô địch hiện tại', interim: 'Tạm thời' },
    finance: {
      title: 'Tài chính & Hợp đồng', collapse: 'Thu gọn', expand: 'Mở rộng', sponsorIncome: 'Thu nhập tài trợ', mediaIncome: 'Thu nhập truyền thông', perMonth: '{{amount}}/tháng', sponsors: 'Nhà tài trợ', mediaDeal: 'Hợp đồng truyền thông', expired: 'Hết hạn', eventBonus: 'Thưởng sự kiện: {{amount}}', expires: 'Hết hạn sau {{count}} ngày ({{date}})', renew: 'Gia hạn', noSponsors: 'Không có hợp đồng tài trợ đang hoạt động.', noMedia: 'Không có hợp đồng truyền thông đang hoạt động.', availableSponsors: 'Nhà tài trợ có thể ký', availableMedia: 'Hợp đồng truyền thông có thể ký', requiredReputation: 'Danh tiếng yêu cầu: {{value}}', locked: 'Đã khóa', signDeal: 'Ký hợp đồng', ledger: 'Sổ cái gần đây', noLedger: 'Không có mục sổ cái nào khớp bộ lọc.', filters: { all: 'Tất cả', event: 'Sự kiện', deals: 'Hợp đồng', costs: 'Chi phí', income: 'Thu nhập' }
    },
    news: { title: 'Tin mới nhất', viewAll: 'Xem tất cả tin', types: { injury: 'Chấn thương', contract: 'Hợp đồng', event: 'Sự kiện', fight: 'Trận đấu', general: 'Chung' } }
  },
  eventBuilder: {
    eyebrow: 'Điều hành giải đấu', editTitle: 'Sửa sự kiện', bookTitle: 'Xếp sự kiện', editDescription: 'Xem lại card đấu, dự báo và công tác tổ chức.', bookDescription: 'Tạo card đấu, xem dự báo rồi xác nhận sự kiện.', completed: 'Sự kiện đã hoàn thành nên không thể chỉnh sửa.', back: 'Quay lại',
    validation: { selectBoth: 'Hãy chọn đủ hai võ sĩ.', sameFighter: 'Võ sĩ không thể tự đấu với chính mình.', suspended: '{{name}} đang bị đình chỉ y tế và không thể xếp lịch.', contract: 'Cả hai võ sĩ cần có hợp đồng còn hiệu lực đến ngày diễn ra sự kiện.', unification: 'Trận thống nhất đai phải có cả hai nhà vô địch.', activeChampion: 'Không thể xếp trận tranh đai nếu thiếu nhà vô địch hiện tại. Hãy thêm nhà vô địch hoặc tắt Tranh đai cho {{belt}}.', interimChampion: 'Nhà vô địch tuyệt đối không thể tranh đai tạm thời. Hãy tắt Tranh đai hoặc chờ trận thống nhất.', activeInterim: 'Không thể xếp trận tranh đai tạm thời nếu thiếu nhà vô địch tạm thời hiện tại.', tournamentFight: 'Đây là trận thuộc giải đấu. Hãy hủy giải tại trang Grand Prix.', autoFill: 'Không thể tự động thêm trận. Võ sĩ có thể đang chấn thương, kiệt sức, chưa ký hợp đồng hoặc không sẵn sàng.', oneFight: 'Hãy thêm ít nhất một trận đấu.', eventName: 'Hãy nhập tên sự kiện.', everyContract: 'Mọi võ sĩ được xếp lịch cần có hợp đồng còn hiệu lực đến ngày diễn ra sự kiện.', cost: 'Chi phí dự kiến là {{cost}}, nhưng bạn chỉ có {{money}}. Bạn có thể bị âm quỹ. Vẫn tiếp tục?', warnings: 'Có {{count}} cảnh báo đang hoạt động. Vẫn xếp sự kiện này?' },
    details: { title: 'Chi tiết sự kiện', eventName: 'Tên sự kiện', date: 'Ngày', venue: 'Địa điểm', ticketPrice: 'Giá vé (USD)', marketingSpend: 'Chi phí quảng bá (USD)', capacity: 'sức chứa {{count}}' },
    matchmaking: { title: 'Ghép trận', autoFill: 'Tự động điền', weightClass: 'Hạng cân', search: 'Tìm võ sĩ', searchLabel: 'Tìm võ sĩ', allReadiness: 'Mọi trạng thái', ready: 'Sẵn sàng', tired: 'Mệt mỏi', redCorner: 'Góc đỏ (hạng cao hơn)', blueCorner: 'Góc xanh', selectFighter: 'Chọn võ sĩ', versus: 'ĐẤU', comparison: 'So sánh cặp đấu', advisory: 'Chỉ là dự báo tham khảo. Kết quả mô phỏng thực tế vẫn khó lường.', recommended: 'Cặp đấu đề xuất', quality: 'Ước tính chất lượng dựa trên thứ hạng, độ nổi tiếng, kình địch và trạng thái sẵn sàng.', use: 'Dùng', titleFight: 'Tranh đai', rounds: 'Số hiệp', addFight: 'Thêm trận vào card' },
    camp: { balanced: 'Cân bằng', striking: 'Đánh đứng +3% · mệt mỏi +5', wrestling: 'Vật +3% · mệt mỏi +5', cardio: 'Thể lực +4% · mệt mỏi -5', recovery: 'Hồi phục · mệt mỏi -10', label: 'Trại tập: {{value}}' },
    projections: { title: 'Dự báo sự kiện', hype: 'Sức hút sự kiện', attendance: 'Khán giả dự kiến', revenue: 'Doanh thu dự kiến', profit: 'Lợi nhuận dự kiến', warnings: 'Cảnh báo ({{count}})', good: 'Card đấu ổn!' },
    card: { heading: 'Card đấu ({{count}})', empty: 'Chưa thêm trận đấu.', emptyHint: 'Dùng bảng ghép trận để thêm cặp đấu.', bout: 'Trận {{number}}', mainEvent: 'Trận chính', coMain: 'Trận đồng chính', mainCard: 'Main card', prelims: 'Prelims', moveUp: 'Đưa {{slot}} lên', moveDown: 'Đưa {{slot}} xuống', remove: 'Xóa {{slot}}', rounds: '{{count}} HIỆP', interim: 'TẠM THỜI', unification: 'THỐNG NHẤT', vacant: 'BỎ TRỐNG', title: 'TRANH ĐAI', gpTitleShot: 'Cơ hội tranh đai GP', gpTitleShotHelp: 'Người thắng Grand Prix được quyền tranh đai tuyệt đối.', gpRoundHelp: 'Một vòng đấu đã xếp lịch trong nhánh Grand Prix.', gpQuarterfinal: 'Tứ kết GP', gpSemifinal: 'Bán kết GP', gpFinal: 'Chung kết GP', update: 'Cập nhật sự kiện', confirm: 'Xác nhận và xếp sự kiện' }
  },
  tournaments: {
    eyebrow: 'Thể thức thi đấu', title: 'Giải Grand Prix', description: 'Tổ chức nhánh loại trực tiếp 4 hoặc 8 người để xác định ứng viên số một.', create: 'Tạo Grand Prix', newTitle: 'Giải Grand Prix mới', close: 'Đóng biểu mẫu giải đấu', name: 'Tên giải đấu', weightClass: 'Hạng cân', format: 'Thể thức', fourMan: 'Grand Prix 4 người', eightMan: 'Grand Prix 8 người', titleShot: 'Hứa cơ hội tranh đai tuyệt đối', titleShotHelp: 'Người thắng Grand Prix được quyền tranh đai tuyệt đối.', selectParticipants: 'Chọn {{count}} võ sĩ', selected: 'Đã chọn {{selected}} / {{count}}', eligibility: 'Chỉ võ sĩ đã ký hợp đồng, khỏe mạnh, chưa có lịch đấu trong hạng cân này mới đủ điều kiện. Xếp hạt giống theo điểm ELO; OVR phá hòa.', noEligible: 'Không có võ sĩ đủ điều kiện ở {{weightClass}}. Hãy ký thêm người hoặc giải phóng võ sĩ đã có lịch.', participant: 'Võ sĩ', reserve: 'Dự bị ({{selected}}/{{count}})', cancel: 'Hủy', createTournament: 'Tạo giải đấu', exactParticipants: 'Hãy chọn đúng {{count}} võ sĩ.', list: 'Danh sách giải đấu', filters: { all: 'Tất cả', active: 'Đang diễn ra', completed: 'Đã hoàn thành', cancelled: 'Đã hủy' }, noMatches: 'Không có giải đấu nào khớp bộ lọc.', winner: 'Người thắng: {{name}}', created: 'Ngày tạo: {{date}}', bracket: 'Nhánh đấu & Chi tiết', statusDivision: 'Trạng thái: {{status}} · Hạng cân: {{division}}', scheduleQuarterfinals: 'Xếp lịch tứ kết', scheduleSemifinals: 'Xếp lịch bán kết', scheduleFinal: 'Xếp lịch chung kết', cancelConfirm: 'Hủy giải đấu này? Các trận đã xếp lịch sẽ bị gỡ.', cancelGp: 'Hủy GP', viewStats: 'Xem thống kê trận →', statsAfterEvent: 'Thống kê có sau khi sự kiện kết thúc.', quarterfinals: 'Tứ kết', quarterfinal: 'Tứ kết {{number}}', semifinals: 'Bán kết', semifinal: 'Trận bán kết {{number}}', final: 'Chung kết', grandPrixFinal: 'Chung kết Grand Prix', championshipFinal: 'Trận chung kết', linkedEvent: 'Sự kiện liên kết', pending: 'Chưa xác định', replacementReserve: 'Dự bị', gpStatus: 'Trạng thái GP: {{status}}', earliestRetry: 'Có thể thử lại sớm nhất: {{date}}', scheduleRound: 'Xếp lịch {{round}}', reserves: 'Võ sĩ dự bị', noReserves: 'Chưa chỉ định võ sĩ dự bị.', ready: 'Sẵn sàng', titleShotPromised: 'Đã hứa cơ hội tranh đai', titleShotDescription: 'Người thắng chắc chắn được tranh đai tuyệt đối với nhà vô địch hạng cân.', history: 'Lịch sử & Nhật ký giải đấu', selectPrompt: 'Chọn một giải trong danh sách hoặc tạo giải mới để xem nhánh đấu và chi tiết.', scheduleTitle: 'Xếp lịch {{round}}', scheduleDescription: 'Chọn một sự kiện sắp tới để tổ chức các trận của giải. Các trận sẽ được thêm vào card sự kiện.', noEvents: 'Chưa xếp sự kiện sắp tới!', noEventsHint: 'Hãy tạo sự kiện từ mục Xếp sự kiện trước.', chooseEvent: 'Chọn sự kiện', selectEvent: '-- Chọn sự kiện --', confirmScheduling: 'Xác nhận xếp lịch', round: { quarterfinal: 'Các trận tứ kết', semifinal: 'Các trận bán kết', final: 'Chung kết Grand Prix' }
  },
  fighterDetail: {
    notFound: 'Không tìm thấy võ sĩ.', tabs: { overview: 'Tổng quan', achievements: 'Thành tích', storylines: 'Cốt truyện', contract: 'Hợp đồng', fights: 'Nhật ký đấu', timeline: 'Dòng thời gian' }, sectionsLabel: 'Các phần chi tiết võ sĩ', years: '{{count}} tuổi', beltAlt: 'Đai vô địch {{type}} hạng {{weightClass}} do {{name}} nắm giữ', interimChampion: 'Nhà vô địch tạm thời', undisputedChampion: 'Nhà vô địch tuyệt đối', record: 'Thành tích', style: 'Phong cách', status: 'Trạng thái', physicalProfile: 'Hồ sơ thể chất', height: 'Chiều cao', fightWeight: 'Cân nặng thi đấu', walkAroundWeight: 'Cân nặng thường ngày', weightCut: 'Mức cắt cân', attributes: 'Thuộc tính', attribute: { striking: 'Đánh đứng', grappling: 'Địa chiến', wrestling: 'Vật', submissions: 'Khóa siết', cardio: 'Thể lực', chin: 'Khả năng chịu đòn', power: 'Sức mạnh', speed: 'Tốc độ', defense: 'Phòng thủ', fightIq: 'Tư duy thi đấu', toughness: 'Độ lì đòn' }, careerSummary: 'Tổng kết sự nghiệp', titleFights: 'Trận tranh đai', currentStreak: 'Chuỗi thắng hiện tại', bestStreak: 'Chuỗi thắng tốt nhất', averagePerformance: 'Màn trình diễn TB', koWins: 'Thắng KO/TKO', submissionWins: 'Thắng khóa siết', decisionWins: 'Thắng bằng điểm', decisionLosses: 'Thua bằng điểm', fourManGp: 'GP 4 người', eightManGp: 'GP 8 người', gpFinals: 'Chung kết GP', gpRecord: 'Thành tích GP', titleShot: 'Cơ hội tranh đai', pending: 'Đang chờ', achievements: 'Thành tích', achievementsDescription: 'Danh hiệu, kết quả Grand Prix, giải thưởng năm và cột mốc giải đấu.', noAchievements: 'Chưa có thành tích. Hãy thắng trận tranh đai, Grand Prix hoặc giải thưởng năm để bổ sung mục này.', achievementCategory: { titles: 'Danh hiệu', grandPrix: 'Grand Prix', awards: 'Giải thưởng', milestones: 'Cột mốc' }, activeStorylines: 'Cốt truyện đang diễn ra', storylinesDescription: 'Kình địch, câu chuyện tranh đai, tranh chấp và các diễn biến khác liên quan đến võ sĩ này.', noStorylines: 'Không có cốt truyện đang hoạt động.', intensity: 'Cường độ {{value}}/3', started: 'Bắt đầu {{date}}', active: 'Đang hoạt động', expires: 'Hết hạn {{date}}', socialActivity: 'Hoạt động xã hội', socialDescription: 'Tin, bài viết, bài đăng và thảo luận liên quan đến {{name}}.', noSocialActivity: 'Chưa có hoạt động xã hội.', contractExtension: 'Hợp đồng & Gia hạn', negotiateContract: 'Đàm phán hợp đồng', release: 'Thanh lý võ sĩ', releaseConfirm: 'Bạn có chắc muốn thanh lý {{name}}?', currentDeal: 'Hợp đồng hiện tại: {{pay}} tiền thi đấu, {{bonus}} thưởng thắng', fightsRemaining: 'Còn {{count}} trận · Kết thúc {{date}}', championExpired: 'Hợp đồng nhà vô địch đã hết hạn. Gia hạn ngay hoặc bỏ trống đai.', offerAccepted: 'Đã chấp nhận đề nghị', offerRejected: 'Đã từ chối đề nghị', counterOffer: 'Đề nghị ngược', counterOfferTerms: '{{pay}} tiền thi đấu · {{bonus}} thưởng thắng · {{count}} trận · hết hạn {{date}}', acceptCounter: 'Chấp nhận đề nghị ngược', expected: 'Kỳ vọng: {{pay}} tiền thi đấu · {{bonus}} thưởng thắng · {{interest}}', payPerFight: 'Tiền mỗi trận (USD)', winBonus: 'Thưởng chiến thắng (USD)', fights: 'Số trận', offerExtension: 'Đề nghị gia hạn', offerContract: 'Đề nghị hợp đồng', respondCounter: 'Hãy phản hồi đề nghị ngược hiện tại trước khi gửi đề nghị khác.', fightLog: 'Nhật ký đấu', date: 'Ngày', event: 'Sự kiện', opponent: 'Đối thủ', result: 'Kết quả', method: 'Phương thức', round: 'Hiệp', unknown: 'Không rõ', draw: 'Hòa', win: 'Thắng', loss: 'Thua', viewFight: 'Xem chi tiết trận với {{opponent}} ngày {{date}}', versus: 'đấu {{name}}', noFights: 'Chưa có trận lưu trữ.', legacyHistory: 'Lịch sử cũ', careerTimeline: 'Dòng thời gian sự nghiệp', noTimeline: 'Chưa có mốc sự nghiệp.', career: { retired: 'Đã giải nghệ', retiredOn: 'Giải nghệ ngày {{date}}', retirementAge: 'Tuổi giải nghệ {{age}}', reason: 'Lý do: {{reason}}', reasons: { age: 'Tuổi tác', injuries: 'Chấn thương tích lũy', decline: 'Suy giảm năng lực thi đấu', inactivity: 'Không thi đấu kéo dài' }, hallOfFame: 'Đại sảnh Danh vọng · Vinh danh năm {{year}} · Điểm di sản {{score}}' }, editor: { edit: 'Chỉnh sửa hồ sơ', title: 'Trình chỉnh sửa võ sĩ', save: 'Lưu thay đổi', cancel: 'Hủy', profile: 'Hồ sơ', physical: 'Thể chất', management: 'Quản lý', firstName: 'Tên', lastName: 'Họ', nickname: 'Biệt danh', age: 'Tuổi', nationality: 'Quốc tịch', weightClass: 'Hạng cân', style: 'Phong cách', potential: 'Tiềm năng', popularity: 'Độ nổi tiếng', morale: 'Tinh thần', momentum: 'Đà phong độ', fatigue: 'Mệt mỏi', error: 'Không thể lưu thay đổi: {{reason}}', errors: { fighterNotFound: 'Không tìm thấy võ sĩ.', invalidName: 'Hãy nhập tên hợp lệ, tối đa 50 ký tự.', invalidNationality: 'Hãy nhập quốc tịch tối đa 50 ký tự.', invalidAge: 'Tuổi phải từ 18 đến 45.', invalidWeightClass: 'Hãy chọn hạng cân hợp lệ.', invalidStyle: 'Hãy chọn phong cách hợp lệ.', invalidAttributes: 'Thuộc tính phải là số từ 10 đến 100.', invalidPotential: 'Tiềm năng phải là số nguyên từ 0 đến 100.', invalidPopularity: 'Độ nổi tiếng phải là số nguyên từ 0 đến 100.', invalidMorale: 'Tinh thần phải là số nguyên từ 0 đến 100.', invalidMomentum: 'Đà phong độ phải là số nguyên từ 0 đến 100.', invalidFatigue: 'Mệt mỏi phải là số nguyên từ 0 đến 100.', invalidPhysicalProfile: 'Chỉ số thể chất phải phù hợp hạng cân và cân nặng thường ngày phải lớn hơn cân nặng thi đấu.', weightClassTitle: 'Võ sĩ đang giữ đai không thể đổi hạng cân.', weightClassBooked: 'Võ sĩ đã có lịch đấu tương lai không thể đổi hạng cân.', weightClassTournament: 'Võ sĩ đang tham gia Grand Prix đã lên kế hoạch hoặc đang diễn ra không thể đổi hạng cân.', weightClassTitleShot: 'Võ sĩ đang được quyền tranh đai không thể đổi hạng cân.' } }
  },
  socialHub: {
    eyebrow: 'Thế giới võ thuật', title: 'Trung tâm xã hội', description: 'Tin tức, bài viết, bài đăng võ sĩ, thảo luận người hâm mộ và các câu chuyện định hình giải đấu.', filtersLabel: 'Bộ lọc trung tâm xã hội', filters: { all: 'Tất cả', news: 'Tin tức', articles: 'Bài viết', fighterPosts: 'Bài võ sĩ', threads: 'Thảo luận' }, feedLabel: 'Bảng tin xã hội', empty: 'Không có bài nào khớp bộ lọc. Hãy xếp trận, chuyển thời gian hoặc mô phỏng sự kiện để tạo hoạt động.', trending: 'Cốt truyện nổi bật', noDrama: 'Chưa có diễn biến đang hoạt động.', intensity: 'Cường độ {{value}}/3', expires: 'Hết hạn {{date}}', promote: 'Quảng bá các trận sắp tới', announced: 'Đã công bố', announce: 'Công bố cặp đấu', hyped: 'Đã quảng bá', hype: 'Quảng bá trận', kind: { news: 'Tin tức', article: 'Bài viết', fighterPost: 'Bài võ sĩ', promotionPost: 'Bài giải đấu', thread: 'Thảo luận' }
  },
  roster: {
    eyebrow: 'Thi đấu',
    title: 'Đội hình giải đấu',
    fighterCount: '{{count}} võ sĩ đang có hợp đồng',
    searchPlaceholder: 'Tìm võ sĩ',
    searchLabel: 'Tìm trong đội hình',
    filters: {
      allWeights: 'Mọi hạng cân',
      allStyles: 'Mọi phong cách',
      anyArchetype: 'Mọi nhóm võ sĩ',
      anyStatus: 'Mọi trạng thái',
      anyContract: 'Mọi hợp đồng',
      expiringSoon: 'Sắp hết hạn',
      star: 'Ngôi sao',
      prospect: 'Tài năng trẻ',
      veteran: 'Lão tướng',
      readyToFight: 'Sẵn sàng thi đấu',
      medicallySuspended: 'Bị đình chỉ y tế',
      fatigued: 'Mệt mỏi'
    },
    columns: {
      fighter: 'Võ sĩ',
      rank: 'Hạng',
      age: 'Tuổi',
      weight: 'Hạng cân',
      record: 'Thành tích',
      style: 'Phong cách',
      overall: 'OVR',
      potential: 'POT',
      popularityMoraleMomentum: 'Độ nổi / Tinh thần / Phong độ',
      status: 'Trạng thái',
      contract: 'Hợp đồng'
    },
    champion: 'Nhà vô địch',
    popularity: 'Độ nổi tiếng',
    morale: 'Tinh thần',
    momentum: 'Phong độ',
    suspended: 'Bị đình chỉ',
    ready: 'Sẵn sàng',
    days: '{{count}} ngày',
    fightsLeft: 'còn {{count}} trận',
    empty: 'Không tìm thấy võ sĩ. Hãy vào trang Ký võ sĩ để tuyển người.'
  },
  freeAgents: {
    eyebrow: 'Tuyển mộ',
    title: 'Võ sĩ tự do',
    fighterCount: '{{count}} võ sĩ khớp tìm kiếm hiện tại',
    searchLabel: 'Tìm võ sĩ tự do',
    anyPopularity: 'Mọi mức nổi tiếng',
    popularityAtLeast: 'Độ nổi {{value}}+',
    columns: {
      fighter: 'Võ sĩ',
      age: 'Tuổi',
      weight: 'Hạng cân',
      record: 'Thành tích',
      style: 'Phong cách',
      overall: 'OVR',
      popularity: 'Độ nổi',
      potential: 'POT',
      ask: 'Lương/Thưởng yêu cầu',
      interest: 'Mức quan tâm'
    },
    fights: 'cho {{count}} trận',
    interest: {
      veryHigh: 'Rất cao',
      high: 'Cao',
      moderate: 'Trung bình',
      low: 'Thấp',
      veryLow: 'Rất thấp'
    },
    empty: 'Không có võ sĩ tự do nào khớp bộ lọc.'
  },
  inbox: {
    eyebrow: 'Điều hành giải đấu',
    title: 'Hộp thư',
    description: 'Các quyết định hiện tại được tạo từ tình hình thực tế của giải đấu.',
    empty: 'Hiện không có quyết định nào cần chú ý.',
    review: 'Xem xét',
    severity: {
      critical: 'Nghiêm trọng',
      urgent: 'Khẩn cấp',
      opportunity: 'Cơ hội'
    }
  },
  calendar: {
    seasonYear: 'Mùa giải {{year}}',
    title: 'Lịch kế hoạch năm',
    currentDate: 'Ngày hiện tại: {{date}}',
    rebuild: 'Lập lại kế hoạch năm',
    rebuildConfirm: 'Bạn có chắc muốn lập lại kế hoạch năm nay? Tất cả ô lịch dự kiến sẽ được tạo lại.',
    counts: {
      planned: 'Dự kiến',
      scheduled: 'Đã xếp lịch',
      completed: 'Đã hoàn thành',
      missed: 'Bị lỡ',
      cancelled: 'Đã hủy'
    },
    filters: {
      all: 'Tất cả',
      regular: 'Thường',
      tentpole: 'Trọng điểm',
      title: 'Tranh đai',
      gpWindow: 'Khung GP',
      gpRound: 'Vòng GP',
      recovery: 'Hồi phục',
      missedCancelled: 'Bị lỡ/Đã hủy'
    },
    gpRoundHelp: 'Một vòng đấu đã xếp lịch trong nhánh Grand Prix.',
    noPlan: 'Chưa có kế hoạch lịch cho năm {{year}}.',
    generate: 'Tạo kế hoạch ngay',
    columns: {
      date: 'Ngày',
      slotType: 'Loại ô lịch',
      status: 'Trạng thái',
      targetDetails: 'Mục tiêu',
      linkedEvent: 'Sự kiện liên kết',
      notes: 'Ghi chú / trì hoãn',
      actions: 'Thao tác'
    },
    noMatches: 'Không có ô lịch nào khớp bộ lọc đã chọn.',
    overdue: 'Quá hạn',
    approaching: 'Sắp tới',
    gpRound: 'GP {{round}}',
    warnings: {
      dateMismatch: 'Lệch ngày',
      noTournament: 'Không có giải đấu',
      overdueSlot: 'Ô lịch quá hạn',
      delayedRound: 'Vòng đấu bị hoãn'
    },
    gpStatus: 'Trạng thái GP: {{status}}',
    retry: 'Thử lại: {{date}}',
    noNotes: 'Không có ghi chú',
    bookCard: 'Xếp card đấu',
    cancelSlot: 'Hủy ô lịch',
    cancel: 'Hủy',
    locked: 'Đã khóa'
  },
  rankings: {
    eyebrow: 'Thi đấu',
    title: 'Bảng xếp hạng giải đấu',
    active: 'Đang hoạt động',
    activeTooltip: 'Nhà vô địch sẵn sàng và trạng thái đai bình thường.',
    inactiveChampion: 'Nhà vô địch vắng mặt',
    inactiveChampionTooltip: 'Nhà vô địch đang vắng mặt; có thể cần một trận tranh đai tạm thời.',
    unificationNeeded: 'Cần thống nhất đai',
    unificationNeededTooltip: 'Nhà vô địch tuyệt đối và tạm thời phải đấu để thống nhất đai.',
    pendingDefense: 'Sắp đến hạn bảo vệ đai',
    pendingDefenseTooltip: 'Nhà vô địch sắp đến khung thời gian dự kiến phải bảo vệ đai.',
    beltAlt: 'Đai vô địch tuyệt đối {{name}}',
    currentDivisionBelt: 'Đai hiện tại của hạng cân',
    prestige: 'Uy tín',
    undisputed: 'Nhà vô địch tuyệt đối',
    interimChampion: 'Nhà vô địch tạm thời',
    vacantTitle: 'Đai đang bỏ trống',
    empty: 'Hạng cân này chưa có võ sĩ được xếp hạng. Hãy ký thêm võ sĩ!',
    columns: {
      rank: 'Hạng',
      move: 'Biến động',
      fighter: 'Võ sĩ',
      record: 'Thành tích',
      status: 'Trạng thái'
    },
    new: 'Mới',
    age: '{{age}} tuổi',
    injured: 'Chấn thương',
    inactive: 'Ít thi đấu',
    declining: 'Đang suy giảm',
    defenses: 'Số lần bảo vệ',
    lastFight: 'Trận gần nhất',
    none: 'Chưa có'
  },
  mmaGuide: {
    eyebrow: 'Cẩm nang Cage Dynasty',
    title: 'Cẩm nang MMA',
    description: 'Giải thích nhanh các thuật ngữ và hệ thống giải đấu dùng trong game. Dùng trang này khi bạn cần biết một cơ hội tranh đai, Grand Prix hoặc kết quả trận đấu có ý nghĩa gì.',
    sections: {
      grandPrix: {
        title: 'Grand Prix & Nhánh đấu',
        eyebrow: 'Thể thức giải đấu',
        entries: {
          grandPrix: { term: 'Grand Prix', description: 'Giải đấu loại trực tiếp trong một hạng cân. Người thua bị loại, người thắng đi tiếp cho đến trận chung kết.' },
          fourMan: { term: 'Grand Prix 4 người', description: 'Gồm 4 võ sĩ: 2 trận bán kết, sau đó là chung kết. Đây là cách nhanh để xác định ứng viên số một.' },
          eightMan: { term: 'Grand Prix 8 người', description: 'Gồm 8 võ sĩ: 4 tứ kết, 2 bán kết và chung kết. Giải dài hơn, uy tín cao hơn và cần chiều sâu đội hình.' },
          seed: { term: 'Hạt giống', description: 'Vị trí hạt giống dựa trên điểm xếp hạng. Hạt giống cao thường được ghép cặp thuận lợi hơn ở vòng đầu.' },
          reserve: { term: 'Võ sĩ dự bị', description: 'Võ sĩ dự bị có thể thay người bị chấn thương hoặc không đủ điều kiện trước một vòng đấu.' },
          rounds: { term: 'Tứ kết / Bán kết / Chung kết', description: 'Ba giai đoạn của nhánh đấu. GP 4 người bắt đầu từ bán kết; GP 8 người bắt đầu từ tứ kết.' }
        }
      },
      belts: {
        title: 'Đai & Ứng viên',
        eyebrow: 'Cuộc đua danh hiệu',
        entries: {
          undisputed: { term: 'Nhà vô địch tuyệt đối', description: 'Nhà vô địch chính thức của hạng cân. Đai này được bảo vệ trong các trận tranh đai.' },
          interim: { term: 'Nhà vô địch tạm thời', description: 'Nhà vô địch tạm thời, thường được tạo ra khi nhà vô địch chính không thể thi đấu trong thời gian dài.' },
          unification: { term: 'Thống nhất đai', description: 'Trận đấu giữa nhà vô địch tuyệt đối và tạm thời để chỉ còn một nhà vô địch.' },
          vacant: { term: 'Đai bỏ trống', description: 'Đai không có chủ sở hữu hiện tại. Hãy xếp hai ứng viên phù hợp tranh đai.' },
          titleShot: { term: 'Cơ hội tranh đai', description: 'Cơ hội đấu với nhà vô địch tuyệt đối. Người thắng Grand Prix có thể được hứa một cơ hội tranh đai.' },
          defense: { term: 'Bảo vệ đai', description: 'Một lần nhà vô địch bảo vệ đai thành công. Thành tích này làm tăng di sản và uy tín của võ sĩ.' }
        }
      },
      fightResults: {
        title: 'Kết quả trận đấu',
        eyebrow: 'Các cách kết thúc trận',
        entries: {
          koTko: { term: 'KO/TKO', description: 'Knockout hoặc technical knockout: trọng tài dừng trận khi một võ sĩ không thể tự vệ hoặc tiếp tục an toàn.' },
          submission: { term: 'Khóa siết', description: 'Thắng bằng đòn khóa khiến đối thủ xin thua, hoặc trọng tài buộc phải dừng để bảo vệ võ sĩ.' },
          decision: { term: 'Phán quyết', description: 'Trận đấu hết số hiệp và được chấm bởi giám khảo. Có thể là đồng thuận, không đồng thuận hoặc đa số.' },
          draw: { term: 'Hòa', description: 'Hai võ sĩ hòa điểm. Đai thường vẫn thuộc về nhà vô địch hiện tại trừ khi luật trận đấu nêu khác.' },
          rating: { term: 'Điểm màn trình diễn', description: 'Điểm chất lượng trận đấu trong game. Điểm cao giúp trận đấu nổi bật hơn trong lịch sử giải đấu.' },
          suspension: { term: 'Đình chỉ y tế', description: 'Thời gian nghỉ bắt buộc sau trận đấu nặng. Võ sĩ không thể được xếp lịch trong giai đoạn này.' }
        }
      },
      promotion: {
        title: 'Điều hành giải đấu',
        eyebrow: 'Kiến thức quản lý cơ bản',
        entries: {
          card: { term: 'Card đấu', description: 'Toàn bộ các trận trong một sự kiện. Card cần đủ trận và võ sĩ phải khỏe mạnh, còn hợp đồng.' },
          mainEvent: { term: 'Trận chính', description: 'Trận quan trọng nhất card. Trận tranh đai và Grand Prix có thể tăng sức hút sự kiện.' },
          ranking: { term: 'Điểm xếp hạng', description: 'Điểm đánh giá sức mạnh và thành tích, dùng để xếp hạng và hỗ trợ xếp hạt giống Grand Prix.' },
          reputation: { term: 'Danh tiếng', description: 'Uy tín của giải đấu. Danh tiếng cao mở khóa cơ hội tài chính tốt hơn và hỗ trợ phát triển.' },
          fanbase: { term: 'Lượng người hâm mộ', description: 'Quy mô khán giả. Lượng người hâm mộ và danh tiếng ảnh hưởng đến lượng người xem và doanh thu sự kiện.' },
          contract: { term: 'Hợp đồng', description: 'Võ sĩ cần hợp đồng còn hiệu lực để thi đấu. Theo dõi số trận còn lại trước khi họ trở thành võ sĩ tự do.' }
        }
      }
    }
  },
  historyStats: {
    eyebrow: 'Hồ sơ giải đấu', title: 'Lịch sử & Thống kê giải đấu', description: 'Xem lại di sản và các kỷ lục lịch sử.', totalEvents: 'Tổng sự kiện', lifetimeProfit: 'Lợi nhuận trọn đời', hallOfFameTitle: 'Đại sảnh Danh vọng', noHallOfFame: 'Chưa có võ sĩ nào được vinh danh.', inductedYear: 'Vinh danh năm {{year}}', legacyTitle: 'Xếp hạng di sản mọi thời đại (Top 10)', rank: 'Hạng', fighter: 'Võ sĩ', weightClass: 'Hạng cân', record: 'Thành tích', legacyScore: 'Điểm di sản', majorAchievements: 'Thành tích lớn', undisputedCount: '{{count}} lần tuyệt đối', interimCount: '{{count}} lần tạm thời', defensesCount: '{{count}} lần bảo vệ', unifiedCount: '({{count}} lần thống nhất)', noLegacy: 'Chưa có dữ liệu di sản. Hãy mô phỏng thêm trận đấu.', gpHistory: 'Lịch sử Grand Prix', filters: { all: 'Tất cả', active: 'Đang diễn ra', completed: 'Đã hoàn thành', cancelled: 'Đã hủy', fourMan: '4 người', eightMan: '8 người' }, date: 'Ngày', tournament: 'Giải đấu', prestige: 'Uy tín', reservesUsed: 'Đã dùng dự bị', winner: 'Người thắng', runnerUp: 'Á quân', titleShotStatus: 'Trạng thái tranh đai', titleShotHelp: 'Người thắng Grand Prix được quyền tranh đai tuyệt đối.', fights: 'Trận đấu', actions: 'Thao tác', noGp: 'Không có Grand Prix nào khớp bộ lọc.', notes: 'Ghi chú ({{count}})', yes: 'Có', no: 'Không', used: 'Đã dùng', pending: 'Đang chờ', pendingShort: 'Chưa xác định', titleShotUsedHelp: 'Cơ hội tranh đai đã hứa đã hoàn thành.', titleShotPendingHelp: 'Người thắng Grand Prix đang được quyền tranh đai tuyệt đối.', titleShotTbdHelp: 'Cần xác định người thắng trước khi theo dõi cơ hội tranh đai đã hứa.', bracket: 'Nhánh đấu', yearlyAwards: 'Giải thưởng hằng năm', fighterOfYear: 'Võ sĩ của năm', fightOfYear: 'Trận đấu của năm', koOfYear: 'KO của năm', submissionOfYear: 'Khóa siết của năm', upsetOfYear: 'Bất ngờ của năm', prospectOfYear: 'Tài năng trẻ của năm', seasonSummary: 'Tổng kết mùa & Lưu trữ lịch', season: 'Mùa {{year}}', completedEvents: 'Sự kiện hoàn thành', tentpoleEvents: 'Sự kiện trọng điểm', completedTournaments: 'Giải đấu hoàn thành', financialNet: 'Tài chính ròng', biggestEvent: 'Sự kiện lớn nhất', attendance: '{{value}} khán giả', noneRecorded: 'Chưa có dữ liệu', bestFight: 'Trận hay nhất', ratingEvent: 'Điểm: {{rating}}% ({{event}})', biggestUpset: 'Bất ngờ lớn nhất', defeated: '{{winner}} thắng {{loser}}', upsetMargin: 'Chênh lệch bất ngờ: +{{value}}%', calendarArchive: 'Lưu trữ ô lịch ({{year}})', slotType: 'Loại ô lịch', status: 'Trạng thái', linkedEvent: 'Sự kiện liên kết', notesColumn: 'Ghi chú', none: 'Không có', recordBook: 'Sổ kỷ lục mọi thời đại', mostFights: 'Thi đấu nhiều nhất', fightCount: '{{count}} trận', mostWins: 'Nhiều trận thắng nhất', winCount: '{{count}} trận thắng', mostKos: 'Nhiều KO/TKO nhất', koCount: '{{count}} KO', mostSubmissions: 'Nhiều khóa siết nhất', submissionCount: '{{count}} khóa siết', mostDefenses: 'Bảo vệ đai nhiều nhất', defenseDivision: '{{count}} lần bảo vệ ({{weightClass}})', fastestKo: 'KO/TKO nhanh nhất', roundTime: 'H{{round}} {{time}}', highestAttendance: 'Khán giả cao nhất', fanCount: '{{value}} khán giả', mostProfitable: 'Lợi nhuận cao nhất', biggestLoss: 'Lỗ lớn nhất', noneYet: 'Chưa có', unknown: 'Không rõ', pastEvents: 'Lưu trữ sự kiện đã qua', noEvents: 'Chưa có sự kiện hoàn thành.', eventSummary: '{{date}} · {{value}} khán giả', revenue: 'Doanh thu', gateRevenue: 'Doanh thu vé', broadcastDeal: 'Truyền hình/Hợp đồng', gpFinalBoost: 'Thưởng chung kết GP', costs: 'Chi phí', venue: 'Địa điểm', marketing: 'Quảng bá', fighterPay: 'Tiền võ sĩ', winBonuses: 'Thưởng thắng', netProfitLoss: 'Lãi/Lỗ ròng', ledgerEntries: 'Mục sổ cái', highestRated: 'Trận đấu được đánh giá cao nhất', noRecordedFights: 'Chưa ghi nhận trận đấu.', rating: 'Điểm {{value}}/100', versus: 'đấu', wonBy: '{{winner}} thắng bằng {{method}} (H{{round}})', titleLineage: 'Dòng lịch sử đai', noTitleHistory: 'Chưa có lịch sử đai.', present: 'Hiện tại', interim: 'Tạm thời', successfulDefense: '{{count}} lần bảo vệ thành công', successfulDefenses: '{{count}} lần bảo vệ thành công'
  },
  debugSim: {
    eyebrow: 'Chẩn đoán', title: 'Trình gỡ lỗi mô phỏng', description: 'Chạy các kiểm tra kịch bản xác định và mô phỏng giải đấu dài hạn.', addCash: '+1 triệu USD', printState: 'In trạng thái', testInvariants: 'Kiểm tra bất biến', runAll: 'Chạy tất cả 200 lần', run200: 'Chạy 200 lần', results: 'Kết quả ({{count}} trận)', redWins: 'Góc đỏ thắng', blueWins: 'Góc xanh thắng', draws: 'Hòa', rates: 'Tỷ lệ', averages: 'Trung bình', extras: 'Bổ sung', finishShort: 'Kết thúc', decisionShort: 'Điểm', doctorShort: 'Bác sĩ', submissionShort: 'Khóa siết', roundShort: 'Hiệp', performanceShort: 'Màn trình diễn', medicalShort: 'Đình chỉ y tế', roundStatsShort: 'Lỗi thống kê hiệp', upsets: 'Bất ngờ', methods: 'Phương thức', sampleCommentary: 'Bình luận mẫu (1 trận)', autopilotTesting: 'Kiểm thử tự động', runDays: 'Chạy {{count}} ngày', runGpWorkflow: 'Chạy quy trình kiểm thử GP', workflowOutput: 'Đầu ra quy trình kiểm thử', simulationReport: 'Báo cáo mô phỏng', tenEightScores: 'Điểm giám khảo 10-8', totalScores: 'Tổng {{count}} điểm', awardsGenerated: 'Giải thưởng đã tạo', eventsCompleted: 'Sự kiện hoàn thành', fightsCount: '{{count}} trận', medicalSuspensions: 'Đình chỉ y tế', totalGiven: 'Tổng số trong mô phỏng', titleStatusCounts: 'Số lượng trạng thái đai', finishMethods: 'Phương thức kết thúc', submission: 'Khóa siết', decision: 'Tính điểm', draw: 'Hòa', dealsLedger: 'Hợp đồng & Sổ cái', activeSponsors: 'Tài trợ đang hoạt động', expiredSponsors: 'Tài trợ hết hạn', activeMedia: 'Truyền thông đang hoạt động', expiredMedia: 'Truyền thông hết hạn', ledgerEntries: 'Mục sổ cái', summaryRows: 'Dòng tổng kết', cashAffecting: 'Ảnh hưởng tiền mặt', ledgerByType: 'Mục sổ cái theo loại', tournamentStats: 'Thống kê giải đấu chi tiết', planned: 'Đã lên kế hoạch', active: 'Đang diễn ra', completedFormats: 'Hoàn thành 4 người / 8 người', cancelled: 'Đã hủy', stuckTournaments: 'Giải đấu bị kẹt', gpShotsPending: 'Suất tranh đai GP đang chờ', gpShotsUsed: 'Suất tranh đai GP đã dùng', reserveReplacements: 'Thay thế bằng dự bị', missingArchiveIds: 'Thiếu FightArchiveId', cadenceStatus: 'Trạng thái nhịp sự kiện:', stalled: 'BỊ ĐÌNH TRỆ', healthy: 'ỔN ĐỊNH', lastCompletedEvent: 'Sự kiện hoàn thành gần nhất', daysAgo: '{{count}} ngày trước', stallNewsPosted: 'Tin đình trệ đã đăng', calendarMetrics: 'Chỉ số lịch năm & kế hoạch mùa', totalSlots: 'Tổng ô lịch', scheduled: 'Đã xếp lịch', completed: 'Đã hoàn thành', missedCancelled: 'Bị lỡ/Đã hủy', gpSlots: 'Ô GP', titleDefenses: 'Bảo vệ đai', tentpoles: 'Sự kiện trọng điểm', stuckDetails: 'Chi tiết giải đấu bị kẹt/trễ:', age: 'Tuổi', needed: 'Cần', status: 'Trạng thái', waitingToSchedule: 'Đang chờ xếp lịch', generalInvariants: 'Bất biến chung của mã nguồn', duplicateChampions: 'Nhà vô địch trùng lặp', completedWithoutResult: 'Sự kiện hoàn thành thiếu kết quả', suspendedBooked: 'Đã xếp võ sĩ bị đình chỉ', ledgerInconsistencies: 'Sổ cái không nhất quán', pastScheduledEvents: 'Sự kiện quá hạn chưa đấu', scheduledNoFights: 'Sự kiện không có trận', unavailableFighters: 'Võ sĩ không khả dụng sắp tới', dateMismatch: 'Ngày ô lịch/sự kiện lệch nhau', fakeGpEvents: 'Sự kiện GP giả', fakeGpSlots: 'Ô GP giả', staleSlots: 'Ô kế hoạch lỗi thời', gpWinners: 'Người thắng Grand Prix', tournamentErrors: 'Lỗi bất biến giải đấu', titleShotErrors: 'Lỗi bất biến nợ tranh đai', roundStatsErrors: 'Phát hiện {{count}} lỗi xác thực roundStats (hiệp thiếu/không có giám khảo)', titleErrors: 'Lỗi bất biến đai', calendarErrors: 'Lỗi toàn vẹn lịch', statePrinted: 'Đã in GameState ra console.', cashAdded: 'Đã thêm 1.000.000 USD', invariantsPassed: 'Bất biến đai đạt yêu cầu! Xem console để biết chi tiết.', invariantFailures: 'PHÁT HIỆN LỖI BẤT BIẾN:', testFailed: 'Kiểm thử thất bại: {{message}}'
  },
  generated: {
    contracts: { notInterested: 'Tôi chưa muốn thi đấu cho một giải đấu ở tầm cỡ này.', accepted: 'Tôi chấp nhận đề nghị. Cùng kiếm tiền nào.', acceptedLow: 'Mức này hơi thấp, nhưng tôi muốn thi đấu ở đây. Tôi đồng ý.', counterOffer: 'Các điều khoản tài chính đã gần phù hợp. Đây là đề nghị ngược của tôi.', rejected: 'Các điều khoản tài chính hiện chưa thể chấp nhận.' },
    social: { unknownFighter: 'Võ sĩ không rõ', bookedHeadline: 'Đã xếp {{matchup}}', bookedBody: 'Trận {{weightClass}}{{title}} được xếp tại {{event}} vào {{date}}.', titleMarker: ' tranh đai', previewHeadline: 'Nhận định cặp đấu: {{red}} đấu {{blue}}', previewBody: '{{redStyle}} đối đầu {{blueStyle}}{{matchup}}{{rivalry}}.', mismatch: ' với chênh lệch OVR đáng chú ý {{value}} điểm', competitive: ' trong một cặp đấu cân bằng', rivalryIntensity: ' cùng mức thù địch {{value}}', rivalryHeadline: '{{red}} đấu {{blue}}: giải quyết ân oán?', rivalryBody: 'Mối thù địch bước vào {{event}}.', wantedReply: 'Đây là trận đấu mọi người đều mong chờ.', mustWatchReply: 'Mức thù địch {{value}}/3 khiến trận này không thể bỏ lỡ.', warningHeadline: '{{name}} gửi lời cảnh báo', campHeadline: '{{name}} cập nhật từ trại tập', warningBody: '“{{opponent}} biết điều gì sắp đến. Mọi thứ kết thúc tại {{event}}.”', campBody: '“Trại tập đang tiến triển tốt. Tôi tôn trọng {{opponent}}, nhưng tôi đã sẵn sàng.”', fightWeekHeadline: 'Tuần thi đấu: {{red}} đấu {{blue}}', fightWeekRivalry: 'Màn đối mặt cuối cùng làm mối thù địch vốn đã cay đắng thêm nóng.', fightWeekNormal: 'Truyền thông và người hâm mộ đưa ra dự đoán cuối cùng.', decisionReply: '{{name}} thắng bằng tính điểm.', finishReply: '{{name}} sẽ kết thúc trận đấu.', resultWinHeadline: '{{winner}} đánh bại {{loser}}', opponent: 'đối thủ', resultDrawHeadline: '{{red}} và {{blue}} hòa nhau', resultBody: '{{event}}: {{method}}, hiệp {{round}} lúc {{time}}.', recapHeadline: 'Bên trong trận đấu: {{red}} đấu {{blue}}', recapBody: 'Màn trình diễn {{value}}/100 tạo nên một điểm nhấn của {{event}}.', winnerReaction: '{{name}} chia sẻ sau trận', winnerReactionBody: '“Công sức đã được đền đáp. Cảm ơn đội ngũ và tất cả những người đã ủng hộ tôi.”', loserReaction: '{{name}} phản hồi', loserReactionBody: '“Thất bại này rất đau, nhưng tôi sẽ học hỏi, hồi phục và trở lại tốt hơn.”', announcedHeadline: '{{red}} đấu {{blue}} chính thức được công bố', hypeHeadline: 'Vì sao {{red}} đấu {{blue}} đáng chú ý', announcedBody: '{{promotion}} xác nhận cặp đấu {{weightClass}} tại {{event}}.', rivalryHype: 'Lịch sử, thứ hạng và ân oán khiến trận này không thể bỏ lỡ.', underdogHype: 'Một thử thách nguy hiểm với cửa trên rõ ràng và cửa dưới đầy quyết tâm.', closeHype: 'Một trận đấu cân sức với ý nghĩa thực sự trong hạng cân.', interestingReply: 'Card đấu này vừa hấp dẫn hơn hẳn.' },
    news: { rivalryDescription: 'Một mối thù địch gay gắt tồn tại giữa {{names}}.', massiveSuccessTitle: 'Thành công vang dội!', massiveSuccess: '{{event}} đạt thành công lớn về tài chính với lợi nhuận {{profit}}.', financialDisappointmentTitle: 'Kết quả tài chính đáng thất vọng', financialDisappointment: '{{event}} không có lãi và thua lỗ {{loss}}.', fansDisappointedTitle: 'Người hâm mộ thất vọng với card đấu', fansDisappointed: 'Người hâm mộ chỉ trích nặng nề {{event}} vì các trận đấu thiếu hấp dẫn.', fanBacklash: 'Giải đấu đang đối mặt với phản ứng dữ dội từ người hâm mộ sau {{event}} đáng thất vọng.', hugeUpsetTitle: 'Cú sốc lớn!', hugeUpset: '{{winner}} gây chấn động khi đánh bại {{loser}}, người được đánh giá cao hơn nhiều.', upsetRun: '{{name}} đang viết câu chuyện cổ tích sau một cú sốc lớn.', controversialDecisionTitle: 'Kết quả gây tranh cãi: {{winner}} đấu {{loser}}', controversialDecision: 'Người hâm mộ đang tranh luận về chiến thắng bằng quyết định không đồng thuận của {{winner}}. Nhiều người cho rằng {{loser}} đã thắng.', rematchDemand: 'Người hâm mộ yêu cầu tái đấu giữa {{winner}} và {{loser}} sau trận đấu gây tranh cãi.', prospectWatchTitle: 'Theo dõi tài năng trẻ: {{name}}', prospectWatch: 'Tài năng trẻ bất bại {{name}} tiếp tục gây ấn tượng và tạo đà thăng tiến.', prospectHype: '{{name}} hiện là một trong những tài năng trẻ nổi bật nhất môn thể thao này.', dominantChampionTitle: 'Nhà vô địch áp đảo', dominantChampion: '{{name}} tỏ ra không thể bị ngăn cản trong lần bảo vệ đai gần nhất.', championDominance: '{{name}} đang thể hiện phong độ bất khả chiến bại trên ngôi vô địch.', fierceRivalryTitle: 'Mối thù địch quyết liệt: {{winner}} đấu {{loser}}', fierceRivalry: 'Cuộc chiến giữa {{winner}} và {{loser}} đã châm ngòi cho một mối thù địch.', contractDisputeTitle: 'Tranh chấp hợp đồng: {{name}}', contractDispute: '{{name}} không hài lòng với hợp đồng hiện tại và yêu cầu mức thù lao tốt hơn.', contractDisputeDescription: '{{name}} đang tranh chấp hợp đồng với giải đấu.', inactivityTitle: '{{name}} thất vọng vì không được thi đấu', inactivity: '{{name}} đã công khai phàn nàn vì không được xếp trận.' },
    inbox: { eventDueTitle: 'Sự kiện đã đến hạn', eventNeedsFightsTitle: 'Sự kiện cần thêm trận', eventDue: '{{event}} đã sẵn sàng tổ chức.', eventNeedsFights: '{{event}} đã xếp {{count}} trong 3 trận bắt buộc.', unavailableTitle: 'Võ sĩ đã xếp không thể thi đấu', unavailable: '{{fighter}} không thể tham dự {{event}}.', championContractExpiredTitle: 'Hợp đồng nhà vô địch đã hết hạn', championContractExpired: 'Gia hạn với {{fighter}} trước khi tình hình đai vô địch trở nên phức tạp.', contractExpiringTitle: 'Hợp đồng sắp hết hạn', contractExpiring: '{{fighter}} còn {{count}} trận trong hợp đồng.', counterOfferTitle: 'Đề nghị ngược đang chờ phản hồi', counterOffer: 'Đề nghị ngược của {{fighter}} hết hạn sau {{count}} ngày.', tournamentTitle: 'Vòng Grand Prix cần xử lý', tournamentNeedsRound: '{{name}} cần được xếp vòng tiếp theo.', titleShotTitle: 'Còn nợ suất tranh đai Grand Prix', titleShot: '{{fighter}} được quyền tranh đai {{weightClass}}.', rivalryTitle: 'Mối thù địch đỉnh điểm đã sẵn sàng xếp trận', depthTitle: 'Hạng {{weightClass}} cần thêm chiều sâu', depth: '{{fighter}} có thể củng cố một hạng cân còn mỏng.', freeAgentTitle: 'Võ sĩ tự do giá trị cao', freeAgent: '{{fighter}} đang sẵn sàng ký hợp đồng.' },
    insights: { unsigned: 'Chưa ký hợp đồng', unsignedDetail: 'Cần hợp đồng trước khi xếp trận.', injured: 'Chấn thương', injuryDetail: '{{type}}: còn {{count}} ngày.', suspended: 'Bị đình chỉ', daysRemaining: 'Còn {{count}} ngày.', exhausted: 'Kiệt sức', exhaustedDetail: 'Mệt mỏi {{value}}/100; cần nghỉ trước khi xếp trận.', tired: 'Mệt', tiredDetail: 'Mệt mỏi {{value}}/100; xếp trận có rủi ro về thể trạng.', ready: 'Sẵn sàng', readyDetail: 'Mệt mỏi {{value}}/100.', styleEdge: '{{winner}} có lợi thế nhỏ về lối đánh trước {{loser}}.', noStyleEdge: 'Không có lợi thế lối đánh rõ ràng.', mismatch: 'Chênh lệch OVR nghiêm trọng ({{value}} điểm).', closeRanking: 'Thứ hạng tương đồng', rankedMatchup: 'Cặp đấu có thứ hạng rõ ràng', overallGap: 'Chênh lệch OVR {{value}}', combinedPopularity: 'Tổng độ nổi tiếng {{value}}', rivalryIntensity: 'Mức thù địch {{value}}', oneTired: 'Một võ sĩ đang mệt', bothReady: 'Cả hai võ sĩ sẵn sàng', neededRound: 'Vòng cần tổ chức: {{round}}', scheduledRound: 'Vòng đã xếp: {{round}}', waitingResults: 'Đang chờ {{count}} kết quả', readySchedule: 'Sẵn sàng xếp lịch', roundBooked: 'Vòng đấu đã được xếp', waitingRetry: 'Đang chờ thử lại', gpDelayed: 'Grand Prix bị trì hoãn', gpPlanned: 'Grand Prix đã được lên kế hoạch', injuryRecap: '{{type}} ({{count}} ngày)', suspensionRecap: 'Đình chỉ y tế ({{count}} ngày)' },
    achievements: { currentChampionTitle: 'Nhà vô địch hiện tại', currentChampion: 'Nhà vô địch hạng {{weightClass}} hiện tại.', interimChampion: 'Nhà vô địch tạm thời', undisputedChampion: 'Nhà vô địch tuyệt đối', heldUntil: 'Giữ đai đến {{date}}', currentReign: 'Triều đại hiện tại hoặc gần nhất', titleWon: 'Giành đai {{weightClass}} ngày {{date}}. {{status}}.', defenseTitle: 'Bảo vệ đai thành công', defenses: '{{count}} lần bảo vệ thành công trong triều đại hạng {{weightClass}} này.', unificationTitle: 'Thống nhất đai tuyệt đối', unification: 'Thống nhất đai tại {{event}}.', gpChampionTitle: 'Nhà vô địch Grand Prix', gpChampion: 'Vô địch {{tournament}} thể thức {{format}}.{{titleShot}}', titleShotUsed: ' Suất tranh đai đã được sử dụng.', titleShotPending: ' Suất tranh đai đang chờ.', gpFinalistTitle: 'Vào chung kết Grand Prix', gpFinalist: 'Vào chung kết {{tournament}}.', gpReserveTitle: 'Dự bị Grand Prix', gpReserve: 'Tham dự {{tournament}} với tư cách võ sĩ dự bị thay thế.', fighterOfYear: 'Võ sĩ của năm', prospectOfYear: 'Tài năng trẻ của năm', fightOfYear: 'Trận đấu của năm', koOfYear: 'KO của năm', submissionOfYear: 'Khóa siết của năm', upsetOfYear: 'Bất ngờ của năm', awardedFor: 'Được trao cho năm {{year}}.', awardAt: 'Giải thưởng năm {{year}} tại {{event}}.', streakTitle: 'Chuỗi thắng', streak: 'Chuỗi thắng dài nhất tại giải đấu: {{count}}.', finisherTitle: 'Chuyên gia kết thúc', finisher: '{{count}} chiến thắng bằng kết thúc tại giải đấu.', titleVeteranTitle: 'Cựu binh tranh đai', titleVeteran: '{{count}} trận tranh đai tại giải đấu.' },
    engine: { monthlySponsorIncome: 'Thu nhập tài trợ hằng tháng: {{name}}', monthlyMediaIncome: 'Thu nhập truyền thông hằng tháng: {{name}}', yearlyAwardsTitle: 'Công bố giải thưởng năm {{year}}', yearlyAwards: 'Giải thưởng năm {{year}} đã được chốt. Hãy xem mục Lịch sử để biết người chiến thắng.', championContractExpiredTitle: 'Hợp đồng nhà vô địch đã hết hạn!', championContractExpired: 'Hợp đồng của {{name}} đã hết hạn. Hãy gia hạn ngay hoặc để trống đai.', contractExpiredTitle: 'Hợp đồng hết hạn: {{name}}', freeAgent: '{{name}} hiện là võ sĩ tự do.', titleStalledTitle: 'Đai {{weightClass}} bị đình trệ', titleStalled: 'Nhà vô địch tuyệt đối hạng {{weightClass}} {{name}} đã không bảo vệ đai hơn 9 tháng.', titleFightCancelledTitle: 'Trận tranh đai bị hủy', titleFightCancelled: 'Trận tranh đai giữa {{red}} và {{blue}} không hợp lệ nên bị hạ thành trận thường. Lý do: {{reason}}', invalidWeightClass: 'Hạng cân tranh đai không hợp lệ.', unificationRequiresChampions: 'Trận thống nhất đai cần cả nhà vô địch tuyệt đối và tạm thời.', unificationRequiresMatchup: 'Trận thống nhất đai phải diễn ra giữa nhà vô địch tuyệt đối và tạm thời.', interimRequiresChampion: 'Trận tranh đai tạm thời đang hoạt động phải có nhà vô địch tạm thời hiện tại.', interimRequiresUndisputed: 'Không thể lập đai tạm thời khi chưa có nhà vô địch tuyệt đối.', undisputedCannotFightInterim: 'Nhà vô địch tuyệt đối không thể tranh đai tạm thời.', activeTitleRequiresChampion: 'Trận tranh đai đang hoạt động phải có nhà vô địch tuyệt đối hiện tại.', historyWin: 'Thắng bằng {{method}} trước {{opponent}} (H{{round}})', historyLoss: 'Thua bằng {{method}} trước {{opponent}} (H{{round}})', historyDraw: 'Hòa với {{opponent}}', unifiedDefenseTitle: 'THỐNG NHẤT ĐAI: {{winner}} đánh bại nhà vô địch tạm thời!', unifiedDefense: '{{winner}} đã thống nhất thành công các đai hạng {{weightClass}} trước {{loser}}.', newUndisputedTitle: 'NHÀ VÔ ĐỊCH TUYỆT ĐỐI MỚI: {{winner}}!', newUndisputed: '{{winner}} thống nhất các đai hạng {{weightClass}} bằng chiến thắng trước {{loser}}.', newInterimTitle: 'NHÀ VÔ ĐỊCH TẠM THỜI MỚI: {{winner}}!', newInterim: '{{winner}} giành đai tạm thời hạng {{weightClass}}!', newChampionTitle: 'NHÀ VÔ ĐỊCH MỚI: {{winner}}!', newChampion: '{{winner}} đánh bại {{loser}} để trở thành nhà vô địch hạng {{weightClass}} mới!', gateBroadcast: 'Vé & truyền hình: {{event}}', dealBonusesBoost: 'Thưởng hợp đồng (gồm thưởng tài trợ chung kết GP 8 người) từ {{event}}', dealBonuses: 'Thưởng hợp đồng từ {{event}}', eightManCommercialBonus: 'Thưởng thương mại chung kết Grand Prix 8 người ({{event}} - đánh giá cao)', fourManCommercialBonus: 'Thưởng thương mại chung kết Grand Prix 4 người ({{event}} - đánh giá cao)', venueRental: 'Thuê địa điểm: {{venue}}', marketing: 'Quảng bá: {{event}}', fighterPurses: 'Thù lao & thưởng võ sĩ: {{event}}', netEvent: 'Lãi/lỗ ròng sự kiện: {{event}}', eventCompletedTitle: '{{event}} hoàn thành', eventCompleted: 'Sự kiện thu hút {{attendance}} khán giả và tạo ra tổng doanh thu {{revenue}}. Phản ứng người hâm mộ đạt {{reaction}}/100.', clearedByUnification: 'Chấm dứt bởi trận thống nhất đai.', unifiedIntoUndisputed: 'Thống nhất thành đai tuyệt đối.' },
    tournament: { unknown: 'Không rõ', quarterfinal: 'tứ kết', semifinal: 'bán kết', final: 'chung kết', fourMan: '4 người', eightMan: '8 người', plannedNote: 'Lên kế hoạch ngày {{date}} với thể thức: {{format}}. Hạt giống: {{seeds}}', titleShotPromise: ' Người thắng sẽ được đảm bảo một suất tranh đai.', announcedTitle: 'Công bố giải đấu: {{name}}', announced: 'Grand Prix {{format}} mới đã được công bố ở hạng {{weightClass}}, quy tụ {{count}} võ sĩ hàng đầu.{{titleShot}} Người tham dự: {{participants}}.', replacementNote: 'Thay thế: {{replacement}} thay võ sĩ không thể thi đấu {{original}} ngày {{date}} ở vòng {{round}}.', replacementTitle: 'Thay thế Grand Prix: {{replacement}} vào vòng {{round}}!', replacement: 'Do chấn thương, đình chỉ hoặc mệt mỏi dài hạn, {{original}} không thể thi đấu. Võ sĩ dự bị {{replacement}} thế chỗ ở vòng {{round}}.', suspendedDelay: '{{fighter}} bị đình chỉ y tế trong {{count}} ngày.', bookedDelay: '{{fighter}} đã được xếp ở sự kiện khác.', unavailableDelay: '{{fighter}} không thể thi đấu và không có võ sĩ dự bị.', delayedNote: 'Vòng {{round}} bị trì hoãn: {{reason}}', delayedTitle: '{{name}} - vòng {{round}} bị trì hoãn', delayed: 'Vòng {{round}} của {{name}} bị trì hoãn. Lý do: {{reason}}. Ngày dự kiến xếp lại sớm nhất: {{date}}.', scheduledNote: 'Vòng {{round}} được xếp tại sự kiện {{event}} ngày {{date}}.', scheduledTitle: '{{name}} - vòng {{round}} đã được xếp!', scheduled: 'Các trận vòng {{round}} được xếp tại {{event}} vào {{date}}!', cancelledNote: 'Giải đấu bị hủy ngày {{date}}.', signingTitle: 'Ký hợp đồng cho giải đấu: {{fighter}}', signing: '{{fighter}} đã ký hợp đồng 4 trận để tăng chiều sâu đội hình Grand Prix hạng {{weightClass}}.', drawTiebreaker: 'Phân định hòa: {{fighter}} đi tiếp từ vòng {{round}} theo thứ tự nhánh đấu.', quarterfinalsCompleteNote: 'Tứ kết hoàn thành. Đã xác định các võ sĩ bán kết.', semifinalistsTitle: '{{name}} đã xác định các võ sĩ bán kết!', semifinalists: 'Vòng tứ kết của {{name}} đã hoàn thành. Các cặp bán kết đã sẵn sàng!', semifinalsCompleteNote: 'Bán kết hoàn thành. Các võ sĩ chung kết: {{fighters}}', finalistsTitle: '{{name}} đã xác định các võ sĩ chung kết!', finalists: 'Nhánh đấu đã được xác định. {{red}} sẽ gặp {{blue}} ở chung kết Grand Prix.', winnerNote: 'Người thắng Grand Prix: {{fighter}} ngày {{date}}', winnerHistory: 'Vô địch Grand Prix trước {{opponent}}', winnerTitle: '{{fighter}} vô địch {{name}}!', winner: '{{fighter}} đánh bại {{opponent}} trong chung kết Grand Prix để lên ngôi!{{titleShot}}', titleShotGuaranteed: ' Một suất tranh đai trong tương lai được đảm bảo.', autopilotDelayedTitle: 'Grand Prix bị trì hoãn: {{name}}', autopilotDelayed: '{{name}} đã bị trì hoãn {{count}} ngày. Ban tổ chức đang tìm phương án khẩn cấp.', autopilotCancelledTitle: 'Grand Prix bị hủy: {{name}}', autopilotCancelled: '{{name}} đã bị hủy do đội hình võ sĩ cạn kiệt lâu dài và hạn chế tài chính.', emergencyReserveNote: 'Ký dự bị khẩn cấp: đã ký {{fighter}} ngày {{date}}.', emergencySigningTitle: 'Ký hợp đồng giải đấu khẩn cấp: {{fighter}}', emergencySigning: 'Cage Dynasty đã ký với võ sĩ tự do {{fighter}} làm dự bị khẩn cấp cho {{name}} đang đình trệ.', calendarLinked: 'Liên kết với {{name}}', calendarCreated: 'Đã tạo và liên kết với {{name}}', calendarRescheduled: 'Dời từ {{from}} sang {{to}} để khớp sự kiện liên kết.', calendarScheduled: 'Đã xếp tại sự kiện {{event}} (Ngày: {{date}})', calendarDelayed: 'Bị trì hoãn: {{reason}}. Ngày sớm nhất: {{date}}', repairedNote: 'Vòng {{round}} được sửa/xếp lại tại sự kiện {{event}} ngày {{date}}.' },
    autobooker: { gpWindowRescheduled: 'Dời khung Grand Prix từ {{date}}. Lý do: {{reason}}', roundDelayed: 'Vòng {{round}} bị trì hoãn: {{reason}}', gpRoundDelayed: 'Vòng GP bị trì hoãn: {{reason}}', gpRoundDelayedTitle: 'Vòng Grand Prix bị trì hoãn', gpRoundRemoved: '{{event}} đã bị gỡ vì không thể xếp lịch giải đấu: {{reason}}', reservedTitleShot: 'Dành cho suất tranh đai của {{fighter}}', emergencyTitleSlot: 'Đã tạo ô tranh đai khẩn cấp ưu tiên cao cho {{fighter}} (Đã chờ: {{count}} ngày)', championInjured: 'Nhà vô địch {{fighter}} chấn thương: {{injury}}', championSuspended: 'Nhà vô địch {{fighter}} bị đình chỉ: {{count}} ngày', championUnavailable: 'Nhà vô địch không thể thi đấu: {{reason}}', marchSafeguard: 'Sự kiện bảo đảm tháng Ba bắt buộc.', gpAlreadyActive: 'GP “{{name}}” đã hoạt động/được lên kế hoạch.', gpWindowConverted: 'Chuyển khung GP thành sự kiện thường vì {{reason}}', gpCreatedLinked: 'Đã tạo và liên kết {{name}} với ô này.', gpWindowConversionFailed: 'Chuyển khung GP thành sự kiện thường. Lý do: {{reason}}', restCompleted: 'Tháng nghỉ hoàn tất ngày {{date}}.', emergencyFundingTitle: 'Bổ sung quỹ khẩn cấp', emergencyFunding: 'Giải đấu đã nhận {{amount}} quỹ khẩn cấp để tránh phá sản, nhưng danh tiếng bị ảnh hưởng.', emergencyFundingLedger: 'Bổ sung quỹ khẩn cấp', emergencySigningTitle: 'Ký hợp đồng khẩn cấp: {{fighter}}', emergencySigning: '{{fighter}} đã ký hợp đồng ngắn hạn để khắc phục tình trạng thiếu võ sĩ.', eventRescheduled: 'Dời từ {{from}} sang {{to}} để khớp sự kiện liên kết.', newEventTitle: 'Công bố sự kiện mới: {{event}}', newEvent: 'Cage Dynasty đã công bố sự kiện tiếp theo, dự kiến ngày {{date}}.', bookingFailed: 'Lần xếp trận ngày {{date}} thất bại do hạn chế đội hình/tài chính.', cadenceStalledTitle: 'Nhịp sự kiện bị đình trệ', cadenceStalled: 'Cage Dynasty tạm thời đình trệ vì đội hình cạn kiệt nghiêm trọng hoặc khó khăn tài chính.', championMissing: 'Không tìm thấy nhà vô địch.', championInjuredPending: 'Nhà vô địch {{fighter}} đang chấn thương.', championSuspendedPending: 'Nhà vô địch {{fighter}} đang bị đình chỉ y tế.', championFatiguedPending: 'Nhà vô địch {{fighter}} đang mệt mỏi.', titleShotPending: 'Autobook đang chờ suất tranh đai: {{reason}}', newSponsorTitle: 'Nhà tài trợ mới: {{name}}', newSponsor: 'Giải đấu đã ký hợp đồng tài trợ cấp {{tier}} mới với {{name}}.', newBroadcastTitle: 'Hợp đồng truyền hình mới: {{name}}', newBroadcast: 'Giải đấu đã ký hợp đồng truyền hình cấp {{tier}} mới với {{name}}.', tierLocal: 'địa phương', tierRegional: 'khu vực', tierNational: 'quốc gia', unificationTitle: 'Đã xếp trận thống nhất đai', unification: '{{red}} và {{blue}} sẽ đấu để thống nhất đai vô địch hạng {{weightClass}}.', gpTitleShotTitle: 'Đã xếp suất tranh đai Grand Prix', gpTitleShot: 'Nhà vô địch Grand Prix {{winner}} sẽ thách đấu nhà vô địch {{champion}} cho đai tuyệt đối hạng {{weightClass}}.', gpVacantTitleShot: '{{winner}} sẽ tranh đai hạng {{weightClass}} đang bỏ trống.', interimTitle: 'Đã xếp trận tranh đai tạm thời hạng {{weightClass}}', interim: '{{red}} và {{blue}} sẽ tranh đai tạm thời hạng {{weightClass}}.', vacantTitle: 'Đã xếp trận tranh đai hạng {{weightClass}} đang bỏ trống', vacant: '{{red}} và {{blue}} sẽ tranh đai hạng {{weightClass}} đang bỏ trống.', fighterReleasedTitle: 'Đã thanh lý võ sĩ', fighterReleased: '{{fighter}} đã được giải phóng khỏi hợp đồng.', newSigningTitle: 'Tân binh: {{fighter}}', newSigning: '{{fighter}} đã ký hợp đồng 4 trận mới.', championExtensionTitle: 'Gia hạn nhà vô địch: {{fighter}}', championExtension: '{{fighter}} đã ký hợp đồng 4 trận mới để bảo vệ đai.', contractRenewedTitle: 'Gia hạn hợp đồng: {{fighter}}', contractRenewed: '{{fighter}} đã ký gia hạn thêm 4 trận.', unknownFighter: 'Võ sĩ không rõ', champion: 'Nhà vô địch', challenger: 'Kẻ thách đấu', unknown: 'Không rõ', titlePostponedTitle: 'Trận tranh đai bị hoãn', titlePostponed: 'Trận tranh đai hạng {{weightClass}} giữa {{red}} và {{blue}} bị hoãn do {{fighter}} chấn thương/bị đình chỉ.', matchupUpdatedTitle: 'Đã cập nhật cặp đấu', matchupUpdated: '{{replacement}} vào thay để đấu với {{opponent}} tại {{event}}, thế chỗ {{replaced}} đang chấn thương/bị đình chỉ.', fightRemovedTitle: 'Đã gỡ trận đấu', fightRemoved: 'Trận giữa {{red}} và {{blue}} đã bị gỡ khỏi {{event}} do {{fighter}} bị đình chỉ y tế/chấn thương.', eventCancelledTitle: 'Sự kiện bị hủy: {{event}}', eventCancelled: '{{event}} đã bị hủy do không đủ cặp đấu và võ sĩ không thể thi đấu.', calendarCancelled: 'Hủy ngày {{date}} do không đủ trận (ít hơn 3).', tournamentEventCancelled: 'Sự kiện {{event}} bị hủy do thiếu võ sĩ.', tournamentRoundCancelled: 'Vòng đấu bị trì hoãn do sự kiện {{event}} bị hủy', pastDueQueued: 'Sự kiện quá hạn được đưa vào hàng đợi mô phỏng ngày {{date}}.' },
    observer: { counterAcceptedTitle: 'Đã chấp nhận đề nghị ngược: {{name}}', counterAccepted: '{{name}} đã đồng ý hợp đồng {{count}} trận.' },
    career: { retirementTitle: '{{name}} giải nghệ', retirement: '{{name}} đã giải nghệ khỏi MMA chuyên nghiệp.', rookieClassTitle: 'Lớp tân binh {{year}} xuất hiện', rookieClass: '{{count}} tài năng trẻ mới đã gia nhập thị trường võ sĩ tự do.', emergencyProspectsTitle: 'Đã bổ sung tài năng trẻ khẩn cấp', emergencyProspects: '{{count}} tài năng trẻ đã gia nhập thị trường võ sĩ tự do hạng {{weightClass}}.', hallOfFameTitle: '{{name}} được vinh danh tại Đại sảnh Danh vọng', hallOfFame: '{{name}} đã được ghi danh vào Đại sảnh Danh vọng với điểm di sản {{score}}.' }
  },
  fight: {
    method: {
      koTko: 'KO/TKO',
      submission: 'Khóa siết',
      unanimousDecision: 'Quyết định đồng thuận',
      splitDecision: 'Quyết định không đồng thuận',
      majorityDecision: 'Quyết định đa số',
      doctorStoppage: 'Bác sĩ dừng trận',
      cornerStoppage: 'Góc đài xin dừng',
      draw: 'Hòa'
    },
    common: { mainEvent: 'Trận chính', coMainEvent: 'Trận đồng chính', bout: 'Trận {{number}}', round: 'Hiệp {{number}}', versus: 'đấu', title: 'Tranh đai', completed: 'Đã hoàn thành', officialResult: 'Kết quả chính thức', judge: 'Giám khảo {{number}}', winner: 'Người thắng', draw: 'Hòa', live: 'Trực tiếp', current: 'Hiện tại', atFight: 'Khi thi đấu' },
    position: { distance: 'Đánh tầm xa', clinch: 'Ôm ghì', ground: 'Địa chiến' },
    stats: { title: 'Thống kê trận đấu', significantStrikes: 'Đòn hiệu quả', totalStrikes: 'Tổng số đòn', headStrikes: 'Đòn vào đầu', bodyLegStrikes: 'Đòn thân / chân', takedowns: 'Quật ngã', controlTime: 'Thời gian kiểm soát', submissionAttempts: 'Lần khóa siết', knockdowns: 'Đánh ngã', damageGiven: 'Sát thương gây ra', fighterStats: 'Thống kê võ sĩ' },
    battle: { description: 'Trận đấu diễn tiến từng hành động từ một lần mô phỏng xác định.', begin: 'Bắt đầu trận', ready: 'Sẵn sàng', pause: 'Tạm dừng', resume: 'Tiếp tục', skip: 'Tới kết quả', wins: '{{name}} chiến thắng', confirmFinish: 'Xác nhận và kết thúc sự kiện', confirmNext: 'Xác nhận kết quả và sang trận sau', commentary: 'Bình luận trực tiếp', roundStatistics: 'Thống kê hiệp', redCorner: 'Góc đỏ', blueCorner: 'Góc xanh', condition: 'Tình trạng', stamina: 'Thể lực', meterLabel: '{{corner}} {{resource}}' },
    prose: { roundBeginsHeadline: 'Hiệp {{round}} bắt đầu', roundBegins: 'Hiệp {{round}} bắt đầu giữa {{red}} và {{blue}}.', strikeLands: '{{name}} tung đòn chính xác', strikeMisses: '{{name}} đánh hụt', groundStrikes: '{{name}} ghi điểm bằng loạt đòn địa chiến.', sharpCombination: '{{name}} ghi điểm bằng một tổ hợp đòn sắc bén.', avoidsAttack: '{{name}} đọc được đòn và né phần lớn cú đánh.', knockdownHeadline: '{{name}} đánh ngã đối thủ', knockdown: '{{attacker}} làm {{defender}} choáng nặng và ngã xuống sàn.', knockdownMoment: 'Hiệp {{round}}: {{name}} đánh ngã', takedownMoment: 'Hiệp {{round}}: {{name}} quật ngã', takedownHeadline: '{{name}} quật ngã thành công', clinchHeadline: '{{name}} ép vào thế ôm ghì', takedown: '{{name}} hạ thấp trọng tâm và giành quyền kiểm soát bên trên.', clinch: '{{name}} chống quật ngã nhưng bị ghì vào lồng.', submissionMoment: 'Hiệp {{round}}: {{name}} thử khóa siết', submissionHeadline: '{{name}} triển khai đòn khóa siết', submissionDanger: '{{name}} đã siết một đòn khóa nguy hiểm.', submissionEscape: '{{name}} giữ bình tĩnh và gỡ được tay khóa.', submissionFinish: '{{attacker}} siết chặt đòn khóa khiến {{defender}} xin thua.', positionHeadline: '{{name}} chuyển vị trí', positionChange: '{{name}} chuyển thế trận từ {{before}} sang {{after}}.', refereeStoppage: '{{name}} buộc trọng tài phải dừng trận.', doctorStoppage: 'Bác sĩ dừng trận vì chấn thương của {{name}}.', compromisedStoppage: '{{name}} thắng sau khi trọng tài dừng trận vì đối thủ không còn khả năng phòng thủ.', closeRound: 'Hiệp đấu cân bằng', edgedRound: '{{name}} nhỉnh hơn trong hiệp', roundEndsHeadline: 'Hiệp {{round}} kết thúc', roundEnds: 'Kết thúc hiệp {{round}}. {{summary}}.', recoveryHeadline: 'Hồi phục giữa hiệp', recovery: 'Hai góc đài chỉ đạo và đưa võ sĩ trở lại thi đấu.', decisionWinner: 'Các giám khảo chấm {{scorecards}} nghiêng về {{name}}.', decisionDraw: 'Các giám khảo chấm {{scorecards}} cho một trận hòa.' },
    event: { notFound: 'Không tìm thấy sự kiện', simulation: 'Mô phỏng sự kiện', fightCount: '{{count}} trận · {{date}}', fightCard: 'Card đấu', resume: 'Tiếp tục sự kiện', start: 'Bắt đầu sự kiện', simulateOneByOne: 'Mô phỏng từng trận một.', completed: 'Sự kiện đã hoàn thành', results: 'Kết quả {{name}}', simulatedDate: '{{date}} · Đã mô phỏng', attendance: 'Khán giả', totalRevenue: 'Tổng doanh thu', totalCost: 'Tổng chi phí', netProfit: 'Lợi nhuận ròng', recap: 'Tổng kết sự kiện', fightOfNight: 'Trận hay nhất đêm', performanceRating: 'Điểm màn trình diễn', rankingImpact: 'Tác động thứ hạng', rankingMovement: 'Biến động thứ hạng sau sự kiện này.', financialResult: 'Kết quả tài chính', financialHelp: 'Lợi nhuận ròng sau chi phí địa điểm, quảng bá và võ sĩ.', fans: 'Người hâm mộ', medicalReport: 'Báo cáo y tế', nextBookingLead: 'Gợi ý xếp trận tiếp theo', nextBookingText: '{{name}} đã sẵn sàng cho một cặp đấu giá trị cao khác.', titleSummary: 'Tổng kết tranh đai', titleUnchanged: 'Đai {{weightClass}} không đổi (Hòa)', titleDefended: '{{name}} đã bảo vệ đai {{weightClass}}!', newChampion: '{{name}} là nhà vô địch {{weightClass}} MỚI!', vacantWon: '{{name}} đã giành đai {{weightClass}} đang bỏ trống!', interimWon: '{{name}} đã giành đai tạm thời {{weightClass}}!', interimDefended: '{{name}} đã bảo vệ đai tạm thời {{weightClass}}!', unified: '{{name}} đã thống nhất đai {{weightClass}}!', pnl: 'Chi tiết lãi lỗ sự kiện', gateRevenue: 'Doanh thu vé', tvSponsor: 'Truyền hình & tài trợ', venueCost: 'Chi phí địa điểm', marketing: 'Quảng bá', fighterBasePay: 'Lương cơ bản võ sĩ', winBonuses: 'Thưởng chiến thắng', fanReaction: 'Phản ứng người hâm mộ', fightResults: 'Kết quả trận đấu', viewDetailsLabel: 'Xem chi tiết trận: {{red}} đấu {{blue}}', viewDetails: 'Xem chi tiết', unavailable: 'Không có' },
    archive: { notFound: 'Không tìm thấy trận đấu', redFighter: 'Võ sĩ góc đỏ', blueFighter: 'Võ sĩ góc xanh', eyebrow: 'Trận đấu lưu trữ', title: 'Chi tiết trận đấu', method: 'Phương thức', round: 'Hiệp', time: 'Thời gian', performance: 'Màn trình diễn', scorecards: 'Phiếu điểm', titleStatus: 'Trạng thái đai', medicalSuspensions: 'Đình chỉ y tế', injury: '{{name}} bị {{type}} (nghỉ {{count}} ngày)', totalStats: 'Tổng thống kê trận', roundByRound: 'Theo từng hiệp', judgesScore: 'Điểm giám khảo', keyMoments: 'Khoảnh khắc chính', noRoundStats: 'Không có thống kê chi tiết từng hiệp cho trận lưu trữ này.', playByPlay: 'Diễn biến đầy đủ', dominance: { close: 'Cân bằng', clear: 'Rõ ràng', dominant: 'Áp đảo', nearFinish: 'Suýt kết thúc' }, titleChange: { newChampion: 'VÀ NHÀ VÔ ĐỊCH MỚI!', titleDefense: 'VẪN LÀ NHÀ VÔ ĐỊCH!', vacantWon: 'Nhà vô địch mới đã đăng quang!', interimWon: 'VÀ NHÀ VÔ ĐỊCH TẠM THỜI MỚI!', interimDefense: 'VẪN LÀ NHÀ VÔ ĐỊCH TẠM THỜI!', unified: 'NHÀ VÔ ĐỊCH TUYỆT ĐỐI!' } },
    tournamentRound: { quarterfinal: 'Tứ kết GP', semifinal: 'Bán kết GP', final: 'Chung kết GP' }
  },
  domain: {
    weightClass: {
      bantamweight: 'Hạng gà',
      featherweight: 'Hạng lông',
      lightweight: 'Hạng nhẹ',
      welterweight: 'Hạng bán trung',
      middleweight: 'Hạng trung',
      heavyweight: 'Hạng nặng'
    },
    fighterStyle: {
      boxer: 'Quyền Anh',
      wrestler: 'Vật',
      bjj: 'Nhu thuật Brazil',
      kickboxer: 'Kickboxing',
      muayThai: 'Muay Thái',
      sambo: 'Sambo',
      balanced: 'Toàn diện'
    },
    tournamentStatus: {
      planned: 'Đã lên kế hoạch',
      active: 'Đang diễn ra',
      completed: 'Đã hoàn thành',
      cancelled: 'Đã hủy'
    },
    titleFightType: {
      undisputed: 'Trận tranh đai tuyệt đối',
      interim: 'Trận tranh đai tạm thời',
      vacantUndisputed: 'Trận tranh đai tuyệt đối đang bỏ trống',
      unification: 'Trận thống nhất đai'
    },
    calendarSlotType: {
      regularEvent: 'Sự kiện thường',
      tentpoleEvent: 'Sự kiện trọng điểm',
      grandPrixWindow: 'Khung Grand Prix',
      grandPrixRound: 'Vòng Grand Prix',
      titleFightCard: 'Card tranh đai',
      recoveryGap: 'Giai đoạn hồi phục'
    },
    calendarSlotStatus: {
      planned: 'Dự kiến',
      scheduled: 'Đã xếp lịch',
      completed: 'Đã hoàn thành',
      missed: 'Bị lỡ',
      cancelled: 'Đã hủy'
    },
    readiness: {
      ready: 'Sẵn sàng',
      fatigued: 'Mệt mỏi',
      injured: 'Chấn thương',
      suspended: 'Bị đình chỉ',
      booked: 'Đã có lịch đấu'
    },
    rank: {
      former: 'Hạng cũ {{rank}} · {{current}}',
      formerDescription: 'Hạng cũ tại giải {{rank}}; hiện tại {{current}}',
      prefixedDescription: '{{prefix}}: {{rank}}'
    }
  }
};

export default vi;
