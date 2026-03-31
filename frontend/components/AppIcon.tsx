'use client';

type AppIconName =
  | 'apartment'
  | 'house'
  | 'villa'
  | 'users'
  | 'door'
  | 'shower'
  | 'ruler'
  | 'floor'
  | 'bedroom'
  | 'bed'
  | 'wifi'
  | 'parking'
  | 'snowflake'
  | 'waves'
  | 'chef-hat'
  | 'washing-machine'
  | 'tv'
  | 'briefcase'
  | 'gym'
  | 'flame'
  | 'balcony'
  | 'leaf'
  | 'bbq'
  | 'shield'
  | 'paw'
  | 'smoke'
  | 'bread'
  | 'plane'
  | 'spa'
  | 'playground'
  | 'bell'
  | 'generic';

export function resolveAmenityIconName(code?: string | null, icon?: string | null): AppIconName {
  const raw = (icon || code || '').trim().toLowerCase().replace(/\s+/g, '-');
  const normalized = raw.replace(/_/g, '-');

  const mapping: Record<string, AppIconName> = {
    apartment: 'apartment',
    house: 'house',
    villa: 'villa',
    wifi: 'wifi',
    parking: 'parking',
    car: 'parking',
    pool: 'waves',
    waves: 'waves',
    'air-conditioner': 'snowflake',
    airconditioner: 'snowflake',
    conditioner: 'snowflake',
    ac: 'snowflake',
    snowflake: 'snowflake',
    heating: 'flame',
    flame: 'flame',
    kitchen: 'chef-hat',
    'chef-hat': 'chef-hat',
    washer: 'washing-machine',
    'washing-machine': 'washing-machine',
    dryer: 'washing-machine',
    tv: 'tv',
    workspace: 'briefcase',
    briefcase: 'briefcase',
    gym: 'gym',
    balcony: 'balcony',
    garden: 'leaf',
    leaf: 'leaf',
    bbq: 'bbq',
    elevator: 'floor',
    security: 'shield',
    shield: 'shield',
    'pets-allowed': 'paw',
    paw: 'paw',
    'smoking-allowed': 'smoke',
    smoke: 'smoke',
    breakfast: 'bread',
    bread: 'bread',
    'airport-transfer': 'plane',
    plane: 'plane',
    spa: 'spa',
    sauna: 'spa',
    playground: 'playground',
    concierge: 'bell',
    bell: 'bell',
  };

  return mapping[normalized] || 'generic';
}

export default function AppIcon({
  name,
  size = 20,
  color = 'currentColor',
  strokeWidth = 1.9,
}: {
  name: AppIconName;
  size?: number;
  color?: string;
  strokeWidth?: number;
}) {
  const common = {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    xmlns: 'http://www.w3.org/2000/svg',
  };

  const strokeProps = {
    stroke: color,
    strokeWidth,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  };

  switch (name) {
    case 'apartment':
      return (
        <svg {...common}>
          <rect x="5" y="3" width="14" height="18" rx="2" {...strokeProps} />
          <path d="M9 7h2M13 7h2M9 11h2M13 11h2M9 15h2M13 15h2" {...strokeProps} />
        </svg>
      );
    case 'house':
      return (
        <svg {...common}>
          <path d="M4 11.5 12 5l8 6.5" {...strokeProps} />
          <path d="M6.5 10.5V20h11v-9.5" {...strokeProps} />
          <path d="M10 20v-5h4v5" {...strokeProps} />
        </svg>
      );
    case 'villa':
      return (
        <svg {...common}>
          <path d="M3.5 11 12 4l8.5 7" {...strokeProps} />
          <path d="M5 10.5V20h14v-9.5" {...strokeProps} />
          <path d="M8 20v-4.5h8V20" {...strokeProps} />
          <path d="M3 20h18" {...strokeProps} />
        </svg>
      );
    case 'users':
      return (
        <svg {...common}>
          <path d="M16 19v-1a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v1" {...strokeProps} />
          <circle cx="10" cy="8" r="3" {...strokeProps} />
          <path d="M20 19v-1a3 3 0 0 0-2-2.82" {...strokeProps} />
          <path d="M15 5.2a3 3 0 0 1 0 5.6" {...strokeProps} />
        </svg>
      );
    case 'door':
      return (
        <svg {...common}>
          <path d="M7 21V4.8c0-.6.4-1.1 1-1.2l7-1.4c.7-.1 1.4.4 1.4 1.2V21" {...strokeProps} />
          <path d="M7 21h10" {...strokeProps} />
          <circle cx="13.2" cy="12" r=".8" fill={color} />
        </svg>
      );
    case 'shower':
      return (
        <svg {...common}>
          <path d="M6 8a6 6 0 0 1 12 0v2H6V8Z" {...strokeProps} />
          <path d="M18 10v2" {...strokeProps} />
          <path d="M9 14v.01M12 15.5v.01M15 14v.01M10.5 17v.01M13.5 18.5v.01" {...strokeProps} />
        </svg>
      );
    case 'ruler':
      return (
        <svg {...common}>
          <path d="M4 16 16 4l4 4L8 20 4 16Z" {...strokeProps} />
          <path d="M11 7l6 6M9 9l2 2M7 11l2 2M13 5l2 2" {...strokeProps} />
        </svg>
      );
    case 'floor':
      return (
        <svg {...common}>
          <rect x="6" y="3" width="12" height="18" rx="2" {...strokeProps} />
          <path d="M9 7h6M9 11h6M9 15h6" {...strokeProps} />
        </svg>
      );
    case 'bedroom':
      return (
        <svg {...common}>
          <path d="M4 12V8a2 2 0 0 1 2-2h4a3 3 0 0 1 3 3v3" {...strokeProps} />
          <path d="M2.5 14h19v4H2.5z" {...strokeProps} />
          <path d="M4 18v2M20 18v2" {...strokeProps} />
        </svg>
      );
    case 'bed':
      return (
        <svg {...common}>
          <path d="M3 12h18v5H3z" {...strokeProps} />
          <path d="M5 12V8h5a2 2 0 0 1 2 2v2" {...strokeProps} />
          <path d="M14 10h4a2 2 0 0 1 2 2" {...strokeProps} />
          <path d="M5 17v3M19 17v3" {...strokeProps} />
        </svg>
      );
    case 'wifi':
      return (
        <svg {...common}>
          <path d="M4.5 9a12 12 0 0 1 15 0M7.5 12a7.5 7.5 0 0 1 9 0M10.5 15a3.2 3.2 0 0 1 3 0" {...strokeProps} />
          <circle cx="12" cy="18" r="1" fill={color} />
        </svg>
      );
    case 'parking':
      return (
        <svg {...common}>
          <rect x="5" y="3" width="10" height="18" rx="2" {...strokeProps} />
          <path d="M9 17V7h3a2.5 2.5 0 0 1 0 5H9" {...strokeProps} />
        </svg>
      );
    case 'snowflake':
      return (
        <svg {...common}>
          <path d="M12 2v20M4.9 6.1l14.2 11.8M19.1 6.1 4.9 17.9M7 4l1.8 3M17 4l-1.8 3M7 20l1.8-3M17 20l-1.8-3" {...strokeProps} />
        </svg>
      );
    case 'waves':
      return (
        <svg {...common}>
          <path d="M3 15c1.2 0 1.8-1 3-1s1.8 1 3 1 1.8-1 3-1 1.8 1 3 1 1.8-1 3-1" {...strokeProps} />
          <path d="M3 19c1.2 0 1.8-1 3-1s1.8 1 3 1 1.8-1 3-1 1.8 1 3 1 1.8-1 3-1" {...strokeProps} />
        </svg>
      );
    case 'chef-hat':
      return (
        <svg {...common}>
          <path d="M6 11a3.5 3.5 0 1 1 1.7-6.6A4 4 0 0 1 15.8 5a3.2 3.2 0 1 1 1.2 6H6Z" {...strokeProps} />
          <path d="M8 11v5a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2v-5" {...strokeProps} />
        </svg>
      );
    case 'washing-machine':
      return (
        <svg {...common}>
          <rect x="5" y="3" width="14" height="18" rx="2" {...strokeProps} />
          <circle cx="12" cy="13" r="4" {...strokeProps} />
          <path d="M8 7h.01M12 7h4" {...strokeProps} />
        </svg>
      );
    case 'tv':
      return (
        <svg {...common}>
          <rect x="4" y="5" width="16" height="12" rx="2" {...strokeProps} />
          <path d="M8 20h8M12 17v3" {...strokeProps} />
        </svg>
      );
    case 'briefcase':
      return (
        <svg {...common}>
          <rect x="4" y="7" width="16" height="12" rx="2" {...strokeProps} />
          <path d="M9 7V5a1.5 1.5 0 0 1 1.5-1.5h3A1.5 1.5 0 0 1 15 5v2M4 12h16" {...strokeProps} />
        </svg>
      );
    case 'gym':
      return (
        <svg {...common}>
          <path d="M5 10v4M19 10v4M7 9v6M17 9v6M9 11h6" {...strokeProps} />
        </svg>
      );
    case 'flame':
      return (
        <svg {...common}>
          <path d="M12 3s4 3.2 4 7.2A4 4 0 1 1 8 12c0-2 1-3.2 2-4.8.7-1 1-2.2 1-4.2Z" {...strokeProps} />
        </svg>
      );
    case 'balcony':
      return (
        <svg {...common}>
          <path d="M5 5h14v5H5zM7 10v9M12 10v9M17 10v9M4 19h16" {...strokeProps} />
        </svg>
      );
    case 'leaf':
      return (
        <svg {...common}>
          <path d="M18 6c-6 .5-9.5 4-10 10 6-.5 9.5-4 10-10Z" {...strokeProps} />
          <path d="M6 18c2-2 4.5-3.5 8-5" {...strokeProps} />
        </svg>
      );
    case 'bbq':
      return (
        <svg {...common}>
          <path d="M7 10h10l-2 5H9l-2-5ZM10 15l-2 5M14 15l2 5" {...strokeProps} />
          <path d="M9 10V6M12 10V5M15 10V6" {...strokeProps} />
        </svg>
      );
    case 'shield':
      return (
        <svg {...common}>
          <path d="M12 3 6 5.5v5.5c0 4 2.8 7.4 6 8.9 3.2-1.5 6-4.9 6-8.9V5.5L12 3Z" {...strokeProps} />
        </svg>
      );
    case 'paw':
      return (
        <svg {...common}>
          <path d="M8.5 9.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3ZM15.5 9.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3ZM6.5 13a1.3 1.3 0 1 0 0-2.6 1.3 1.3 0 0 0 0 2.6ZM17.5 13a1.3 1.3 0 1 0 0-2.6 1.3 1.3 0 0 0 0 2.6Z" {...strokeProps} />
          <path d="M12 19c2.7 0 4.5-1.3 4.5-3.1 0-1.7-1.6-2.9-3.2-2.9-.8 0-1.2.3-1.3.8-.1-.5-.5-.8-1.3-.8-1.6 0-3.2 1.2-3.2 2.9C7.5 17.7 9.3 19 12 19Z" {...strokeProps} />
        </svg>
      );
    case 'smoke':
      return (
        <svg {...common}>
          <path d="M6 16h12M6 12h6M16 12c1.1 0 2 .9 2 2v2M13 8c1.2.7 2 1.8 2 3" {...strokeProps} />
        </svg>
      );
    case 'bread':
      return (
        <svg {...common}>
          <path d="M8 8a4 4 0 0 1 8 0 3 3 0 0 1 2 2.8V18a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2v-7.2A3 3 0 0 1 8 8Z" {...strokeProps} />
        </svg>
      );
    case 'plane':
      return (
        <svg {...common}>
          <path d="M3 13l18-6-6 18-2.8-7.2L3 13Z" {...strokeProps} />
        </svg>
      );
    case 'spa':
      return (
        <svg {...common}>
          <path d="M7 15c1.5 0 2.5-.8 3-2.2.5 1.4 1.5 2.2 3 2.2s2.5-.8 3-2.2c.5 1.4 1.5 2.2 3 2.2" {...strokeProps} />
          <path d="M9 10c0-1.6 1-3 3-4 2 1 3 2.4 3 4" {...strokeProps} />
        </svg>
      );
    case 'playground':
      return (
        <svg {...common}>
          <path d="M5 19 12 5l7 14M8 13h8M10 19v-3M14 19v-3" {...strokeProps} />
        </svg>
      );
    case 'bell':
      return (
        <svg {...common}>
          <path d="M6 16h12l-1.2-1.8V10a4.8 4.8 0 1 0-9.6 0v4.2L6 16Z" {...strokeProps} />
          <path d="M10 18a2 2 0 0 0 4 0" {...strokeProps} />
        </svg>
      );
    default:
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="7" {...strokeProps} />
        </svg>
      );
  }
}
