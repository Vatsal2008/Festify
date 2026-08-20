// components/icons/Icons.jsx — Crisp inline SVG icons replacing all emojis across Festify

export function IconWrapper({ children, size = 18, color = 'currentColor', className = '', ...rest }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`festify-icon ${className}`}
      {...rest}
    >
      {children}
    </svg>
  );
}

export function HomeIcon(props) {
  return (
    <IconWrapper {...props}>
      <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <polyline points="9 22 9 12 15 12 15 22" />
    </IconWrapper>
  );
}

export function SearchIcon(props) {
  return (
    <IconWrapper {...props}>
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.3-4.3" />
    </IconWrapper>
  );
}

export function TicketIcon(props) {
  return (
    <IconWrapper {...props}>
      <path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z" />
      <path d="M13 5v2" />
      <path d="M13 11v2" />
      <path d="M13 17v2" />
    </IconWrapper>
  );
}

export function UserIcon(props) {
  return (
    <IconWrapper {...props}>
      <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </IconWrapper>
  );
}

export function BellIcon(props) {
  return (
    <IconWrapper {...props}>
      <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
      <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
    </IconWrapper>
  );
}

export function ZapIcon({ filled, ...props }) {
  return (
    <IconWrapper fill={filled ? 'currentColor' : 'none'} {...props}>
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
    </IconWrapper>
  );
}

export function HeartIcon({ filled, ...props }) {
  return (
    <IconWrapper fill={filled ? 'currentColor' : 'none'} {...props}>
      <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
    </IconWrapper>
  );
}

export function StarIcon({ filled, half, ...props }) {
  return (
    <IconWrapper fill={filled ? 'currentColor' : 'none'} {...props}>
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </IconWrapper>
  );
}

export function CalendarIcon(props) {
  return (
    <IconWrapper {...props}>
      <rect width="18" height="18" x="3" y="4" rx="2" ry="2" />
      <line x1="16" x2="16" y1="2" y2="6" />
      <line x1="8" x2="8" y1="2" y2="6" />
      <line x1="3" x2="21" y1="10" y2="10" />
    </IconWrapper>
  );
}

export function MapPinIcon(props) {
  return (
    <IconWrapper {...props}>
      <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
      <circle cx="12" cy="10" r="3" />
    </IconWrapper>
  );
}

export function UsersIcon(props) {
  return (
    <IconWrapper {...props}>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </IconWrapper>
  );
}

export function GraduationCapIcon(props) {
  return (
    <IconWrapper {...props}>
      <path d="M22 10v6M2 10l10-5 10 5-10 5z" />
      <path d="M6 12v5c3 3 9 3 12 0v-5" />
    </IconWrapper>
  );
}

export function CodeIcon(props) {
  return (
    <IconWrapper {...props}>
      <polyline points="16 18 22 12 16 6" />
      <polyline points="8 6 2 12 8 18" />
    </IconWrapper>
  );
}

export function TheaterIcon(props) {
  return (
    <IconWrapper {...props}>
      <path d="M2 10s3-3 10-3 10 3 10 3v9a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2z" />
      <path d="M12 7v14" />
      <path d="M6 12h.01" />
      <path d="M18 12h.01" />
    </IconWrapper>
  );
}

export function MusicIcon(props) {
  return (
    <IconWrapper {...props}>
      <path d="M9 18V5l12-2v13" />
      <circle cx="6" cy="18" r="3" />
      <circle cx="18" cy="16" r="3" />
    </IconWrapper>
  );
}

export function TrophyIcon(props) {
  return (
    <IconWrapper {...props}>
      <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
      <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
      <path d="M4 22h16" />
      <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" />
      <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" />
      <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" />
    </IconWrapper>
  );
}

export function MicIcon(props) {
  return (
    <IconWrapper {...props}>
      <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
      <line x1="12" x2="12" y1="19" y2="22" />
    </IconWrapper>
  );
}

export function SparklesIcon(props) {
  return (
    <IconWrapper {...props}>
      <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" />
      <path d="M5 3v4" />
      <path d="M19 17v4" />
      <path d="M3 5h4" />
      <path d="M17 19h4" />
    </IconWrapper>
  );
}

export function CheckIcon(props) {
  return (
    <IconWrapper {...props}>
      <polyline points="20 6 9 17 4 12" />
    </IconWrapper>
  );
}

export function XIcon(props) {
  return (
    <IconWrapper {...props}>
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </IconWrapper>
  );
}

export function AlertTriangleIcon(props) {
  return (
    <IconWrapper {...props}>
      <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
      <line x1="12" x2="12" y1="9" y2="13" />
      <line x1="12" x2="12.01" y1="17" y2="17" />
    </IconWrapper>
  );
}

export function InfoIcon(props) {
  return (
    <IconWrapper {...props}>
      <circle cx="12" cy="12" r="10" />
      <line x1="12" x2="12" y1="16" y2="12" />
      <line x1="12" x2="12.01" y1="8" y2="8" />
    </IconWrapper>
  );
}

export function CameraIcon(props) {
  return (
    <IconWrapper {...props}>
      <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z" />
      <circle cx="12" cy="13" r="3" />
    </IconWrapper>
  );
}

export function ShieldIcon(props) {
  return (
    <IconWrapper {...props}>
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </IconWrapper>
  );
}

export function SettingsIcon(props) {
  return (
    <IconWrapper {...props}>
      <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
      <circle cx="12" cy="12" r="3" />
    </IconWrapper>
  );
}

export function BarChartIcon(props) {
  return (
    <IconWrapper {...props}>
      <line x1="12" x2="12" y1="20" y2="10" />
      <line x1="18" x2="18" y1="20" y2="4" />
      <line x1="6" x2="6" y1="20" y2="16" />
    </IconWrapper>
  );
}

export function MessageSquareIcon(props) {
  return (
    <IconWrapper {...props}>
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </IconWrapper>
  );
}

export function PlusIcon(props) {
  return (
    <IconWrapper {...props}>
      <line x1="12" x2="12" y1="5" y2="19" />
      <line x1="5" x2="19" y1="12" y2="12" />
    </IconWrapper>
  );
}

export function ArrowRightIcon(props) {
  return (
    <IconWrapper {...props}>
      <line x1="5" x2="19" y1="12" y2="12" />
      <polyline points="12 5 19 12 12 19" />
    </IconWrapper>
  );
}

export function ArrowLeftIcon(props) {
  return (
    <IconWrapper {...props}>
      <line x1="19" x2="5" y1="12" y2="12" />
      <polyline points="12 19 5 12 12 5" />
    </IconWrapper>
  );
}

export function ChevronDownIcon(props) {
  return (
    <IconWrapper {...props}>
      <polyline points="6 9 12 15 18 9" />
    </IconWrapper>
  );
}

export function QrCodeIcon(props) {
  return (
    <IconWrapper {...props}>
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <path d="M14 14h3v3h-3z" />
      <path d="M20 14v.01M14 20v.01M20 20v.01M17 20v.01M20 17v.01" />
    </IconWrapper>
  );
}

export function EyeIcon(props) {
  return (
    <IconWrapper {...props}>
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
      <circle cx="12" cy="12" r="3" />
    </IconWrapper>
  );
}

export function EyeOffIcon(props) {
  return (
    <IconWrapper {...props}>
      <path d="M10.7 5.1A10.4 10.4 0 0 1 12 5c6.5 0 10 7 10 7a17.8 17.8 0 0 1-3.2 4.2M6.6 6.6A17.6 17.6 0 0 0 2 12s3.5 7 10 7a10.3 10.3 0 0 0 5.4-1.5" />
      <path d="m2 2 20 20" />
      <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
    </IconWrapper>
  );
}
