import { Award, BookOpen, CircleDot, Shield, Swords } from 'lucide-react';
import { Panel } from '../components/ui';

type GuideEntry = {
  term: string;
  description: string;
};

export const MMA_GUIDE_SECTIONS: Array<{ title: string; eyebrow: string; entries: GuideEntry[] }> = [
  {
    title: 'Grand Prix & Brackets',
    eyebrow: 'TOURNAMENT FORMAT',
    entries: [
      { term: 'Grand Prix', description: 'Giải đấu loại trực tiếp trong một hạng cân. Người thua bị loại, người thắng đi tiếp cho đến trận chung kết.' },
      { term: '4-Man Grand Prix', description: 'Gồm 4 võ sĩ: 2 trận bán kết, sau đó là chung kết. Đây là cách nhanh để xác định ứng viên số một.' },
      { term: '8-Man Grand Prix', description: 'Gồm 8 võ sĩ: 4 tứ kết, 2 bán kết và chung kết. Giải dài hơn, uy tín cao hơn và cần chiều sâu đội hình.' },
      { term: 'Seed', description: 'Thứ hạng hạt giống dựa trên điểm ranking. Seed cao thường được ghép cặp thuận lợi hơn ở vòng đầu.' },
      { term: 'Reserve Fighter', description: 'Võ sĩ dự bị có thể thay người bị chấn thương hoặc không đủ điều kiện trước một vòng đấu.' },
      { term: 'Quarterfinal / Semifinal / Final', description: 'Tứ kết / Bán kết / Chung kết. GP 4 người bắt đầu từ bán kết; GP 8 người bắt đầu từ tứ kết.' }
    ]
  },
  {
    title: 'Belts & Contenders',
    eyebrow: 'TITLE PICTURE',
    entries: [
      { term: 'Undisputed Champion', description: 'Nhà vô địch chính thức của hạng cân. Đai này được bảo vệ trong các trận title fight.' },
      { term: 'Interim Champion', description: 'Nhà vô địch tạm thời, thường được tạo ra khi champion chính không thể thi đấu trong thời gian dài.' },
      { term: 'Unification', description: 'Trận hợp nhất đai giữa undisputed champion và interim champion để chỉ còn một nhà vô địch.' },
      { term: 'Vacant Title', description: 'Đai đang bỏ trống, không có champion. Hãy book trận tranh đai giữa hai contender phù hợp.' },
      { term: 'Title Shot', description: 'Cơ hội đấu với undisputed champion. Người thắng Grand Prix có thể được hứa một title shot.' },
      { term: 'Title Defense', description: 'Một lần champion bảo vệ đai thành công. Defenses làm tăng di sản và uy tín của võ sĩ.' }
    ]
  },
  {
    title: 'Fight Results',
    eyebrow: 'HOW A FIGHT ENDS',
    entries: [
      { term: 'KO/TKO', description: 'Knockout hoặc technical knockout: trọng tài dừng trận khi một võ sĩ không thể tự vệ hoặc tiếp tục an toàn.' },
      { term: 'Submission', description: 'Thắng bằng khóa siết khiến đối thủ tap out, hoặc trọng tài buộc phải dừng để bảo vệ võ sĩ.' },
      { term: 'Decision', description: 'Trận đấu hết số hiệp và được chấm bởi giám khảo. Có thể là unanimous, split hoặc majority decision.' },
      { term: 'Draw', description: 'Hòa sau khi chấm điểm. Đai thường vẫn thuộc về champion hiện tại trừ khi luật trận đấu nêu khác.' },
      { term: 'Performance Rating', description: 'Điểm chất lượng trận đấu trong game. Rating cao giúp trận đấu nổi bật hơn trong lịch sử promotion.' },
      { term: 'Medical Suspension', description: 'Thời gian nghỉ bắt buộc sau trận đấu nặng. Võ sĩ không thể được book trong giai đoạn này.' }
    ]
  },
  {
    title: 'Running a Promotion',
    eyebrow: 'MANAGER BASICS',
    entries: [
      { term: 'Fight Card', description: 'Toàn bộ các trận trong một event. Card cần đủ trận và võ sĩ phải khỏe mạnh, còn hợp đồng.' },
      { term: 'Main Event', description: 'Trận quan trọng nhất card. Trong game, title fight và trận GP thường được dùng để tăng sức hút event.' },
      { term: 'Ranking Score', description: 'Điểm đánh giá sức mạnh/thành tích, dùng để xếp hạng và hỗ trợ seed cho Grand Prix.' },
      { term: 'Reputation', description: 'Uy tín promotion. Uy tín cao mở khóa cơ hội tài chính tốt hơn và giúp phát triển promotion.' },
      { term: 'Fanbase', description: 'Quy mô người hâm mộ. Fanbase và reputation ảnh hưởng đến tiềm năng attendance, doanh thu event.' },
      { term: 'Contract', description: 'Võ sĩ cần hợp đồng còn hiệu lực để thi đấu. Theo dõi số trận còn lại trước khi họ trở thành free agent.' }
    ]
  }
];

const sectionIcons = [Award, Shield, Swords, CircleDot];

export default function MmaGuide() {
  return (
    <div className="mx-auto max-w-6xl space-y-8 pb-12">
      <header className="border-b border-[#2a2c31] pb-6">
        <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-neutral-500">Cage Dynasty field manual</p>
        <h1 className="mt-2 text-3xl font-normal tracking-[-0.04em] text-white sm:text-4xl">MMA Guide</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-neutral-400">
          Giải thích nhanh các thuật ngữ và hệ thống giải đấu dùng trong game. Dùng trang này khi bạn cần biết một title shot, Grand Prix hoặc kết quả trận đấu có ý nghĩa gì.
        </p>
      </header>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {MMA_GUIDE_SECTIONS.map((section, index) => {
          const Icon = sectionIcons[index];
          return (
            <Panel key={section.title} className="overflow-hidden p-0">
              <div className="flex items-center gap-3 border-b border-[#2a2c31] p-4 sm:p-5">
                <Icon size={18} className="shrink-0 text-neutral-400" />
                <div>
                  <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-neutral-500">{section.eyebrow}</p>
                  <h2 className="mt-1 text-lg font-normal tracking-[-0.02em] text-white">{section.title}</h2>
                </div>
              </div>
              <dl className="divide-y divide-[#2a2c31]">
                {section.entries.map(entry => (
                  <div key={entry.term} className="p-4 transition-colors hover:bg-white/[0.02] sm:p-5">
                    <dt className="text-sm font-medium text-white">{entry.term}</dt>
                    <dd className="mt-1.5 text-sm leading-6 text-neutral-400">{entry.description}</dd>
                  </div>
                ))}
              </dl>
            </Panel>
          );
        })}
      </div>
    </div>
  );
}
