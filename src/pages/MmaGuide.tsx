import { Award, CircleDot, Shield, Swords } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Panel } from '../components/ui';

const sectionIcons = [Award, Shield, Swords, CircleDot];

export default function MmaGuide() {
  const { t } = useTranslation('translation');
  const sections = [
    t($ => $.mmaGuide.sections.grandPrix, { returnObjects: true }),
    t($ => $.mmaGuide.sections.belts, { returnObjects: true }),
    t($ => $.mmaGuide.sections.fightResults, { returnObjects: true }),
    t($ => $.mmaGuide.sections.promotion, { returnObjects: true })
  ];

  return (
    <div className="mx-auto max-w-6xl space-y-8 pb-12">
      <header className="border-b border-[#2a2c31] pb-6">
        <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-neutral-500">{t($ => $.mmaGuide.eyebrow)}</p>
        <h1 className="mt-2 text-3xl font-normal tracking-[-0.04em] text-white sm:text-4xl">{t($ => $.mmaGuide.title)}</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-neutral-400">{t($ => $.mmaGuide.description)}</p>
      </header>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {sections.map((section, index) => {
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
                {Object.values(section.entries).map(entry => (
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
