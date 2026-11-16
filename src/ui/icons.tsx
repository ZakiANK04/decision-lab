import type { ReactNode } from 'react';

export type IconName =
  | 'expand_fossil'
  | 'invest_green'
  | 'balanced_mix'
  | 'raise_wages'
  | 'training'
  | 'automation'
  | 'cut_costs'
  | 'lower_prices'
  | 'improve_quality'
  | 'marketing'
  | 'reduce_waste'
  | 'hold'
  | 'profit'
  | 'productivity'
  | 'environment'
  | 'customer'
  | 'worker'
  | 'sound_on'
  | 'sound_off'
  | 'undo'
  | 'play'
  | 'pause'
  | 'share'
  | 'dice'
  | 'close'
  | 'arrow'
  | 'restart'
  | 'world'
  | 'joystick'
  | 'cloud'
  | 'link'
  | 'image';

const P: Record<IconName, ReactNode> = {
  expand_fossil: (
    <>
      <path d="M12 3c1 3 4 4.5 4 8.5a4 4 0 0 1-8 0C8 9.5 9.5 9 10 7c1 .8 1.6 1.6 2 3 .6-2 .4-4.500 0-7z" />
      <path d="M6 20h12" />
    </>
  ),
  invest_green: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2.500v2.500M12 19v2.500M2.500 12H5M19 12h2.500M5.300 5.300l1.800 1.800M16.900 16.900l1.800 1.800M5.300 18.700l1.800-1.800M16.900 7.100l1.800-1.800" />
    </>
  ),
  balanced_mix: (
    <>
      <path d="M12 4v16M7 20h10M5 7h14" />
      <path d="M5 7l-2.500 6a2.700 2.700 0 0 0 5 0L5 7zM19 7l-2.500 6a2.700 2.700 0 0 0 5 0L19 7z" />
    </>
  ),
  raise_wages: (
    <>
      <ellipse cx="12" cy="7" rx="6.500" ry="2.800" />
      <path d="M5.500 7v5c0 1.500 2.900 2.800 6.500 2.800s6.500-1.300 6.500-2.800V7M5.500 12v5c0 1.500 2.900 2.800 6.500 2.800s6.500-1.300 6.500-2.800v-5" />
    </>
  ),
  training: (
    <>
      <path d="M2.500 9.500L12 5l9.500 4.500L12 14 2.500 9.500z" />
      <path d="M6.500 11.800V16c1.500 1.500 3.300 2.200 5.500 2.200s4-0.700 5.500-2.200v-4.200M21.500 9.500V15" />
    </>
  ),
  automation: (
    <>
      <circle cx="12" cy="12" r="3.200" />
      <path d="M12 2.800l1.400 2.600 2.900-0.600 0.600 2.900 2.600 1.400-1.300 2.900 1.300 2.900-2.600 1.400-0.600 2.900-2.900-0.600L12 21.200l-1.400-2.600-2.900 0.600-0.600-2.900-2.600-1.400L5.800 12 4.500 9.100l2.600-1.400 0.600-2.900 2.900 0.600L12 2.800z" />
    </>
  ),
  cut_costs: (
    <>
      <circle cx="6.500" cy="6.500" r="2.800" />
      <circle cx="6.500" cy="17.500" r="2.800" />
      <path d="M8.700 8.400L20 18M8.700 15.600L20 6" />
    </>
  ),
  lower_prices: (
    <>
      <path d="M3.500 12.500V4.500h8l9 9-8 8-9-9z" />
      <circle cx="8" cy="9" r="1.400" />
      <path d="M13 12.500v5M10.800 15.300l2.200 2.200 2.200-2.200" />
    </>
  ),
  improve_quality: <path d="M12 3.200l2.700 5.600 6.100 0.800-4.500 4.300 1.100 6.100L12 17.100 6.600 20l1.100-6.100-4.500-4.300 6.100-0.800L12 3.200z" />,
  marketing: (
    <>
      <path d="M4 10v4h3l8 4.500V5.500L7 10H4z" />
      <path d="M18 9.500a3.500 3.500 0 0 1 0 5M8 14.500l1.200 4.500" />
    </>
  ),
  reduce_waste: (
    <>
      <path d="M5 19C5 10.500 10 5 20 4.500 19.500 14.500 14 19.500 5.500 19.500" />
      <path d="M5 19.500c2-5 5.500-8.500 10-10.500" />
    </>
  ),
  hold: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M10 8.500v7M14 8.500v7" />
    </>
  ),
  profit: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M14.800 9.300c-0.500-1-1.500-1.500-2.800-1.500-1.700 0-2.900 0.800-2.900 2.100 0 3 5.900 1.300 5.900 4.300 0 1.300-1.300 2.100-3 2.100-1.400 0-2.600-0.600-3.100-1.700M12 6v1.800M12 16.300V18" />
    </>
  ),
  productivity: (
    <>
      <circle cx="12" cy="12" r="3.200" />
      <path d="M12 2.800l1.400 2.600 2.900-0.600 0.600 2.900 2.600 1.400-1.300 2.900 1.300 2.900-2.600 1.400-0.600 2.900-2.900-0.600L12 21.200l-1.400-2.600-2.900 0.600-0.600-2.900-2.600-1.400L5.800 12 4.500 9.100l2.600-1.400 0.600-2.900 2.900 0.600L12 2.800z" />
    </>
  ),
  environment: (
    <>
      <path d="M12 21v-8" />
      <path d="M12 13c0-4 2.500-6.500 7.500-7 0 4.500-2.500 7-7.500 7zM12 16c0-3-2-5-6.500-5.500 0 3.500 2 5.500 6.500 5.500z" />
    </>
  ),
  customer: <path d="M12 3.200l2.700 5.600 6.100 0.800-4.500 4.300 1.100 6.100L12 17.100 6.600 20l1.100-6.100-4.500-4.300 6.100-0.800L12 3.200z" />,
  worker: (
    <>
      <rect x="3.500" y="7.500" width="17" height="12" rx="3" />
      <path d="M9 7.500V6a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v1.500M3.500 12.500h17" />
    </>
  ),
  sound_on: (
    <>
      <path d="M4 10v4h3.500l5 4V6l-5 4H4z" />
      <path d="M16 9a4 4 0 0 1 0 6M18.500 6.500a7.500 7.500 0 0 1 0 11" />
    </>
  ),
  sound_off: (
    <>
      <path d="M4 10v4h3.500l5 4V6l-5 4H4z" />
      <path d="M16.500 9.500l4.500 5M21 9.500l-4.500 5" />
    </>
  ),
  undo: (
    <>
      <path d="M8 5L4 9l4 4" />
      <path d="M4 9h10a5.500 5.500 0 0 1 0 11H9" />
    </>
  ),
  play: <path d="M7 4.500v15l12.500-7.500L7 4.500z" />,
  pause: <path d="M8 5v14M16 5v14" />,
  share: (
    <>
      <circle cx="6" cy="12" r="2.600" />
      <circle cx="17.500" cy="6" r="2.600" />
      <circle cx="17.500" cy="18" r="2.600" />
      <path d="M8.300 10.800l6.900-3.600M8.300 13.200l6.900 3.600" />
    </>
  ),
  dice: (
    <>
      <rect x="4" y="4" width="16" height="16" rx="4" />
      <circle cx="9" cy="9" r="1" fill="currentColor" />
      <circle cx="15" cy="15" r="1" fill="currentColor" />
      <circle cx="15" cy="9" r="1" fill="currentColor" />
      <circle cx="9" cy="15" r="1" fill="currentColor" />
    </>
  ),
  close: <path d="M6 6l12 12M18 6L6 18" />,
  arrow: <path d="M5 12h14M13 6l6 6-6 6" />,
  restart: (
    <>
      <path d="M19.500 12a7.500 7.500 0 1 1-2.400-5.500" />
      <path d="M19.500 4v4h-4" />
    </>
  ),
  world: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18" />
    </>
  ),
  joystick: (
    <>
      <circle cx="12" cy="6" r="2.800" />
      <path d="M12 8.800V15M5 15h14v3.500a1.500 1.500 0 0 1-1.500 1.500h-11A1.500 1.500 0 0 1 5 18.500V15z" />
    </>
  ),
  cloud: <path d="M7 18.500a4.500 4.500 0 0 1-0.500-9 5.500 5.500 0 0 1 10.700 1.300 3.900 3.900 0 0 1-0.700 7.700H7z" />,
  link: (
    <>
      <path d="M10 14a4 4 0 0 0 5.700 0l3-3a4 4 0 0 0-5.700-5.700l-1 1" />
      <path d="M14 10a4 4 0 0 0-5.700 0l-3 3a4 4 0 0 0 5.700 5.700l1-1" />
    </>
  ),
  image: (
    <>
      <rect x="3.500" y="4.500" width="17" height="15" rx="3.500" />
      <circle cx="9" cy="10" r="1.600" />
      <path d="M4.500 17l5-4.500 4 3.500 2.500-2 3.500 3" />
    </>
  ),
};

export function Icon({ name, size = 20, stroke = 2 }: { name: IconName; size?: number; stroke?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      {P[name]}
    </svg>
  );
}
