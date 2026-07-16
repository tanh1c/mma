import { useTranslation } from 'react-i18next';
import { PageHeader, Panel } from '../components/ui';
import { useSettingsStore } from '../store/settingsStore';
import type { UnitSystem } from '../lib/displayUnits';
import type { Language } from '../lib/localization';

export default function SettingsPage() {
  const { t } = useTranslation('translation');
  const { unitSystem, language, setUnitSystem, setLanguage } = useSettingsStore();
  const unitOptions: Array<{ value: UnitSystem; label: string; description: string }> = [
    { value: 'metric', label: t($ => $.settings.metric), description: t($ => $.settings.metricDescription) },
    { value: 'us', label: t($ => $.settings.imperial), description: t($ => $.settings.imperialDescription) }
  ];
  const languageOptions: Array<{ value: Language; label: string; description: string }> = [
    { value: 'en', label: t($ => $.common.english), description: t($ => $.settings.englishDescription) },
    { value: 'vi', label: t($ => $.common.vietnamese), description: t($ => $.settings.vietnameseDescription) }
  ];

  return <div className="space-y-6">
    <PageHeader eyebrow={t($ => $.settings.eyebrow)} title={t($ => $.settings.title)} description={t($ => $.settings.description)} />
    <Panel>
      <fieldset>
        <legend className="text-lg font-medium tracking-tight text-white">{t($ => $.settings.units)}</legend>
        <p className="mt-1 text-sm text-neutral-500">{t($ => $.settings.unitsDescription)}</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {unitOptions.map(option => <label key={option.value} className={`cursor-pointer rounded-lg border p-4 transition-colors focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-white ${unitSystem === option.value ? 'border-white bg-white/[0.06]' : 'border-[#2a2c31] hover:bg-white/[0.02]'}`}>
            <span className="flex items-start gap-3">
              <input type="radio" name="unit-system" value={option.value} checked={unitSystem === option.value} onChange={() => setUnitSystem(option.value)} className="mt-1 accent-white" />
              <span><span className="block font-medium text-white">{option.label}</span><span className="mt-1 block text-sm text-neutral-400">{option.description}</span></span>
            </span>
          </label>)}
        </div>
      </fieldset>
    </Panel>
    <Panel>
      <fieldset>
        <legend className="text-lg font-medium tracking-tight text-white">{t($ => $.common.language)}</legend>
        <p className="mt-1 text-sm text-neutral-500">{t($ => $.settings.languageDescription)}</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {languageOptions.map(option => <label key={option.value} className={`cursor-pointer rounded-lg border p-4 transition-colors focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-white ${language === option.value ? 'border-white bg-white/[0.06]' : 'border-[#2a2c31] hover:bg-white/[0.02]'}`}>
            <span className="flex items-start gap-3">
              <input type="radio" name="language" value={option.value} checked={language === option.value} onChange={() => setLanguage(option.value)} className="mt-1 accent-white" />
              <span><span className="block font-medium text-white">{option.label}</span><span className="mt-1 block text-sm text-neutral-400">{option.description}</span></span>
            </span>
          </label>)}
        </div>
      </fieldset>
    </Panel>
  </div>;
}
