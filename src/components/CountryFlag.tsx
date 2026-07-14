import { getNationalityCode } from '../lib/branding';

type CountryFlagProps = {
  nationality: string;
  className?: string;
};

export function CountryFlag({ nationality, className = '' }: CountryFlagProps) {
  const code = getNationalityCode(nationality);
  if (code === 'un') return <span className={className}>{nationality}</span>;

  return <span aria-label={nationality} className={`fi fi-${code} ${className}`} role="img" title={nationality} />;
}
