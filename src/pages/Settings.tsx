import { PageHeader, Panel } from '../components/ui';
import { useSettingsStore } from '../store/settingsStore';
import type { UnitSystem } from '../lib/displayUnits';

const options: Array<{ value: UnitSystem; label: string; description: string }> = [
  { value: 'metric', label: 'Metric', description: 'Centimetres and kilograms' },
  { value: 'us', label: 'US / Imperial', description: 'Feet, inches, and pounds' }
];

export default function SettingsPage() {
  const { unitSystem, setUnitSystem } = useSettingsStore();

  return <div className="space-y-6">
    <PageHeader eyebrow="Preferences" title="Settings" description="Display preferences apply across all saved games." />
    <Panel>
      <fieldset>
        <legend className="text-lg font-medium tracking-tight text-white">Units</legend>
        <p className="mt-1 text-sm text-neutral-500">Choose how fighter height and weight are displayed.</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {options.map(option => <label key={option.value} className={`cursor-pointer rounded-lg border p-4 transition-colors focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-white ${unitSystem === option.value ? 'border-white bg-white/[0.06]' : 'border-[#2a2c31] hover:bg-white/[0.02]'}`}>
            <span className="flex items-start gap-3">
              <input type="radio" name="unit-system" value={option.value} checked={unitSystem === option.value} onChange={() => setUnitSystem(option.value)} className="mt-1 accent-white" />
              <span><span className="block font-medium text-white">{option.label}</span><span className="mt-1 block text-sm text-neutral-400">{option.description}</span></span>
            </span>
          </label>)}
        </div>
      </fieldset>
    </Panel>
  </div>;
}
