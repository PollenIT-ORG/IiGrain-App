import { ICONS } from '../../components/AppIcon';
import type { AccountInfoItem } from '../../components/account';
import type { AuthUser } from '../../api/authApi';
import { capitalize } from '../../utils';

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export const formatMemberSince = (iso?: string | null): string | null => {
  if (!iso) {
    return null;
  }
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return `${date.getDate()} ${MONTHS[date.getMonth()]} ${date.getFullYear()}`;
};

// Keep these in sync with ios/iiGrain.xcodeproj/project.pbxproj —
// MARKETING_VERSION and CURRENT_PROJECT_VERSION respectively.
export const APP_VERSION = '2.0';
export const APP_BUILD = '8';

/** What the user sees, e.g. "2.0 (4)". */
export const APP_VERSION_LABEL = `${APP_VERSION} (${APP_BUILD})`;

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
  memberSinceISO?: string | null,
): AccountInfoItem[] => {
  const roleLabel = capitalize((user?.role ?? '').trim()) || 'Farmer';
  const email = (user?.email ?? '').trim();
  const phone = (user?.phone ?? '').trim();
  const memberSince = formatMemberSince(memberSinceISO);

  const items: AccountInfoItem[] = [
    { id: 'type', icon: ICONS.USER, label: 'Account Type', value: roleLabel },
    {
      id: 'status',
      icon: ICONS.SUCCESS,
      label: 'Account Status',
      badge: { status: 'active' },
    },
    ...(memberSince
      ? [{ id: 'since', icon: ICONS.CALENDAR, label: 'Member Since', value: memberSince }]
      : []),
    {
      id: 'email',
      icon: ICONS.EMAIL,
      label: 'Registered Email',
      value: email || '—',
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
    value: APP_VERSION_LABEL,
  });

  return items;
};
