import React from 'react';

interface IconProps {
  className?: string;
}

function lni(iconName: string, defaultSize = 'text-base') {
  const Component: React.FC<IconProps> = ({ className = '' }) => (
    <i
      className={`lni ${iconName} inline-flex items-center justify-center leading-none shrink-0 ${defaultSize} ${className}`}
      aria-hidden="true"
    />
  );
  return Component;
}

export const Icons = {
  Home: lni('lni-home', 'text-[17px]'),
  Campaigns: lni('lni-rocket', 'text-[17px]'),
  Inbox: lni('lni-inbox', 'text-[17px]'),
  Leads: lni('lni-users', 'text-[17px]'),
  Domains: lni('lni-world', 'text-[17px]'),
  TownCrier: lni('lni-bullhorn', 'text-[17px]'),
  Admin: lni('lni-shield', 'text-[17px]'),
  Profile: lni('lni-user', 'text-[17px]'),
  Plus: lni('lni-plus', 'text-[14px]'),
  Trash: lni('lni-trash-can', 'text-[14px]'),
  Key: lni('lni-key', 'text-[16px]'),
  Users: lni('lni-users', 'text-[16px]'),
  Send: lni('lni-envelope', 'text-[15px]'),
  Download: lni('lni-download', 'text-[15px]'),
  Upload: lni('lni-cloud-upload', 'text-[17px]'),
  Code: lni('lni-code', 'text-[15px]'),
  Tag: lni('lni-tag', 'text-[14px]'),
  Sparkles: lni('lni-bolt-alt', 'text-[15px]'),
  Menu: lni('lni-menu', 'text-[18px]'),
  Close: lni('lni-close', 'text-[15px]'),
  Book: lni('lni-book', 'text-[16px]'),
  Bell: lni('lni-alarm', 'text-[16px]'),
  Search: lni('lni-search-alt', 'text-[15px]'),
  Bolt: lni('lni-bolt-alt', 'text-[15px]'),
  Refresh: lni('lni-reload', 'text-[15px]'),
  CheckCircle: lni('lni-checkmark-circle', 'text-[15px]'),
  Warning: lni('lni-ban', 'text-[15px]'),
  Lock: lni('lni-lock', 'text-[16px]'),
  Link: lni('lni-link', 'text-[14px]'),
  Eye: lni('lni-eye', 'text-[15px]'),
  Image: lni('lni-image', 'text-[16px]'),
  Settings: lni('lni-cog', 'text-[16px]'),
  ChevronLeft: lni('lni-chevron-left', 'text-[13px]'),
  Copy: lni('lni-files', 'text-[14px]'),
  Terminal: lni('lni-code-alt', 'text-[15px]'),
};