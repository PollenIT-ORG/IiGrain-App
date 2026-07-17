import { ICONS } from '../../components/AppIcon';
import type { AccountInfoItem } from '../../components/account';
import type { AuthUser } from '../../api/authApi';
import { capitalize } from '../../utils';

export const APP_VERSION = '1.0.0';

const MEMBER_SINCE = 'January 2025';

export const DELETE_REMOVES: string[] = [
  'Your profile and personal details',
  'All farms and fields you have added',
  'Every assessment and its answers',
  'Uploaded images, videos and documents',
  'Your activity history and progress',
  'Saved preferences and app settings',
];

export const buildAccountInfoItems = (
  user: AuthUser | null,
  organization?: string,
): AccountInfoItem[] => {
  const roleLabel = capitalize((user?.role ?? '').trim()) || 'Farmer';
  const email = (user?.email ?? '').trim();
  const phone = (user?.phone ?? '').trim();

  const items: AccountInfoItem[] = [
    { id: 'type', icon: ICONS.USER, label: 'Account Type', value: roleLabel },
    {
      id: 'status',
      icon: ICONS.SUCCESS,
      label: 'Account Status',
      badge: { status: 'active' },
    },
    { id: 'since', icon: ICONS.CALENDAR, label: 'Member Since', value: MEMBER_SINCE },
    {
      id: 'email',
      icon: ICONS.EMAIL,
      label: 'Registered Email',
      value: email || '-',
      muted: !email,
    },
    {
      id: 'phone',
      icon: ICONS.PHONE,
      label: 'Phone Number',
      value: phone || 'Not provided',
      muted: !phone,
    },
  ];

  if (organization && organization.trim()) {
    items.push({
      id: 'org',
      icon: ICONS.ORGANIZATION,
      label: 'Organization',
      value: organization.trim(),
    });
  }

  items.push({
    id: 'version',
    icon: ICONS.INFO,
    label: 'App Version',
    value: APP_VERSION,
  });

  return items;
};
