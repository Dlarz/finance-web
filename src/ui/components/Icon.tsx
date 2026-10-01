import { ICON_SVG } from '../../icons/iconPaths';

interface IconProps {
  name: string;
  className?: string;
  /** Accessible label; without it the icon is decorative. */
  label?: string;
  style?: React.CSSProperties;
}

export function Icon({ name, className, label, style }: IconProps) {
  const svg = ICON_SVG[name] ?? ICON_SVG['category'] ?? '';
  return (
    <svg
      className={`icon${className ? ` ${className}` : ''}`}
      viewBox="0 0 24 24"
      aria-hidden={label ? undefined : true}
      role={label ? 'img' : undefined}
      aria-label={label}
      style={style}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}

export function CategoryIcon({ iconKey, colorHex, size, soft }: { iconKey: string; colorHex: string; size?: string; soft?: boolean }) {
  return (
    <span
      className={`icon-circle${soft ? ' icon-circle--soft' : ''}`}
      style={soft ? ({ '--icon-color': colorHex, ...(size ? { '--size': size } : {}) } as React.CSSProperties) : ({ background: colorHex, ...(size ? { '--size': size } : {}) } as React.CSSProperties)}
    >
      <Icon name={iconKey} />
    </span>
  );
}
