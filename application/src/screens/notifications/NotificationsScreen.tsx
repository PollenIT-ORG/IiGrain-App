import React, { useCallback, useMemo, useState } from 'react';
import { CommonActions, useNavigation } from '@react-navigation/native';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, View } from 'react-native';
import { AppIcon, ICONS } from '../../components/AppIcon';
import { AppHeader, AppText, Button } from '../../components';
import ConfirmDialog from '../../components/ConfirmDialog/ConfirmDialog';
import { AppShimmerRow } from '../../components/Shimmer';
import { EmptyState } from '../../components/farms';
import { COLORS } from '../../constants';
import { addAlpha, moderateScale, scale } from '../../utils';
import { useAppDispatch, useAppSelector } from '../../redux/hooks';
import {
  fetchNotificationsThunk,
  fetchMoreNotificationsThunk,
  markNotificationReadThunk,
  markAllNotificationsReadThunk,
  deleteNotificationThunk,
  deleteNotificationsThunk,
  deleteAllNotificationsThunk,
  selectNotificationsRaw,
  selectUnreadCount,
  selectHasMoreNotifications,
  selectNotificationsLoading,
  selectNotificationsRefreshing,
  selectNotificationsLoadingMore,
  selectNotificationsError,
  selectMarkingAllNotifications,
  selectNotificationsPage,
  selectDeletingNotificationIds,
  selectDeletingAllNotifications,
} from '../../redux/slices/notificationSlice';
import { selectAuthUser } from '../../redux/slices/authSlice';
import { useSyncedFetch } from '../../hooks/useSyncedFetch';
import { Tags } from '../../redux/syncTags';
import { metaForNotificationType, formatRelativeTime } from './notificationPresenter';
import { targetForRedirect } from './notificationRoute';
import type { AppNotification } from '../../types/notification';
import { styles } from './NotificationsScreenStyle';

/** The list is socket-driven, so this only guards against a very long session. */
const NOTIFICATIONS_TTL_MS = 5 * 60 * 1000;

type Prompt = 'deleteSelected' | 'deleteAll' | null;

const NotificationsScreen: React.FC = () => {
  const dispatch = useAppDispatch();
  const navigation = useNavigation();
  const isAssessor = useAppSelector(selectAuthUser)?.role === 'assessor';

  const items = useAppSelector(selectNotificationsRaw);
  const unreadCount = useAppSelector(selectUnreadCount);
  const loading = useAppSelector(selectNotificationsLoading);
  const refreshing = useAppSelector(selectNotificationsRefreshing);
  const loadingMore = useAppSelector(selectNotificationsLoadingMore);
  const hasMore = useAppSelector(selectHasMoreNotifications);
  const page = useAppSelector(selectNotificationsPage);
  const error = useAppSelector(selectNotificationsError);
  const markingAll = useAppSelector(selectMarkingAllNotifications);
  const deletingIds = useAppSelector(selectDeletingNotificationIds);
  const deletingAll = useAppSelector(selectDeletingAllNotifications);

  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [prompt, setPrompt] = useState<Prompt>(null);

  const load = useCallback(() => {
    dispatch(fetchNotificationsThunk({ page: 1 }));
  }, [dispatch]);

  // Was an unconditional fetch on every mount — and this is a stack screen, so
  // every push hit the API. Now it loads once and refetches only when the socket
  // reports a new notification (or after the TTL).
  useSyncedFetch({
    tags: [Tags.notifications],
    run: load,
    hasData: items !== null,
    ttlMs: NOTIFICATIONS_TTL_MS,
  });

  const onEndReached = useCallback(() => {
    if (!loadingMore && hasMore) {
      dispatch(fetchMoreNotificationsThunk(page + 1));
    }
  }, [dispatch, loadingMore, hasMore, page]);

  // ── Selection ──────────────────────────────────────────────────────────────
  const exitSelectMode = useCallback(() => {
    setSelectMode(false);
    setSelected([]);
  }, []);

  const toggleSelected = useCallback((id: string) => {
    setSelected(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id],
    );
  }, []);

  const enterSelectMode = useCallback((id: string) => {
    setSelectMode(true);
    setSelected([id]);
  }, []);

  const visibleIds = useMemo(() => (items ?? []).map(n => n.id), [items]);
  const allSelected = visibleIds.length > 0 && selected.length === visibleIds.length;

  const toggleSelectAll = useCallback(() => {
    setSelected(allSelected ? [] : visibleIds);
  }, [allSelected, visibleIds]);

  // ── Actions ────────────────────────────────────────────────────────────────
  const onPressItem = useCallback(
    (item: AppNotification) => {
      if (selectMode) {
        toggleSelected(item.id);
        return;
      }
      if (!item.read) {
        dispatch(markNotificationReadThunk(item.id));
      }
      // `redirect` is always present; an unmapped key resolves to null and the
      // user simply stays on the list.
      const target = targetForRedirect(item.redirect, isAssessor);
      if (!target) {
        return;
      }
      navigation.dispatch(
        CommonActions.navigate({ name: target.screen, params: target.params }),
      );
    },
    [dispatch, navigation, isAssessor, selectMode, toggleSelected],
  );

  const onMarkAllRead = useCallback(() => {
    dispatch(markAllNotificationsReadThunk());
  }, [dispatch]);

  const onDeleteOne = useCallback(
    (id: string) => {
      dispatch(deleteNotificationThunk(id));
    },
    [dispatch],
  );

  const confirmPrompt = useCallback(() => {
    if (prompt === 'deleteSelected') {
      dispatch(deleteNotificationsThunk(selected));
      exitSelectMode();
    } else if (prompt === 'deleteAll') {
      dispatch(deleteAllNotificationsThunk());
      exitSelectMode();
    }
    setPrompt(null);
  }, [prompt, dispatch, selected, exitSelectMode]);

  // ── Rendering ──────────────────────────────────────────────────────────────
  const renderItem = useCallback(
    ({ item }: { item: AppNotification }) => {
      const meta = metaForNotificationType(item.type);
      const isSelected = selected.includes(item.id);
      const isDeleting = deletingIds.includes(item.id);
      return (
        <Pressable
          onPress={() => onPressItem(item)}
          onLongPress={() => enterSelectMode(item.id)}
          disabled={isDeleting}
          accessibilityRole="button"
          accessibilityLabel={item.title}
          accessibilityState={selectMode ? { selected: isSelected } : undefined}
          style={({ pressed }) => [
            styles.card,
            !item.read && styles.cardUnread,
            isSelected && styles.cardSelected,
            (pressed || isDeleting) && styles.cardPressed,
          ]}>
          {selectMode ? (
            <View style={[styles.checkbox, isSelected && styles.checkboxOn]}>
              {isSelected ? (
                <AppIcon name={ICONS.CHECK} size={moderateScale(14)} color={COLORS.white} />
              ) : null}
            </View>
          ) : (
            <View style={[styles.iconCircle, { backgroundColor: addAlpha(meta.color, 0.12) }]}>
              <AppIcon name={meta.icon} size={moderateScale(20)} color={meta.color} />
            </View>
          )}

          <View style={styles.textCol}>
            <View style={styles.titleRow}>
              <AppText
                style={[styles.title, !item.read && styles.titleUnread]}
                numberOfLines={1}>
                {item.title}
              </AppText>
              {!item.read ? <View style={styles.dot} /> : null}
            </View>
            {item.body ? (
              <AppText style={styles.message} numberOfLines={2}>
                {item.body}
              </AppText>
            ) : null}
            <AppText style={styles.time}>{formatRelativeTime(item.createdAtISO)}</AppText>
          </View>

          {!selectMode ? (
            <Pressable
              onPress={() => onDeleteOne(item.id)}
              disabled={isDeleting}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel={`Delete ${item.title}`}
              style={styles.rowDeleteBtn}>
              {isDeleting ? (
                <ActivityIndicator size="small" color={COLORS.gray500} />
              ) : (
                <AppIcon name={ICONS.DELETE} size={moderateScale(18)} color={COLORS.gray500} />
              )}
            </Pressable>
          ) : null}
        </Pressable>
      );
    },
    [onPressItem, onDeleteOne, enterSelectMode, selectMode, selected, deletingIds],
  );

  const renderSkeleton = () => (
    <View style={styles.body}>
      {[0, 1, 2, 3, 4, 5].map(i => (
        <AppShimmerRow key={i} showLeading leadingSize={scale(44)} lines={2} style={styles.card} />
      ))}
    </View>
  );

  const renderEmpty = () => (
    <EmptyState
      icon="bell-outline"
      title="No notifications yet"
      message="We'll let you know here when there's something new — programs, assessments, and visits."
    />
  );

  const renderError = () => (
    <View style={styles.stateCenter}>
      <AppIcon name={ICONS.ERROR} size={moderateScale(48)} color={COLORS.gray500} />
      <AppText style={styles.stateTitle}>Couldn't load notifications</AppText>
      <AppText style={styles.stateMessage}>{error}</AppText>
      <Button title="Retry" onPress={load} fullWidth={false} style={styles.retryBtn} />
    </View>
  );

  const renderFooter = () =>
    loadingMore ? (
      <View style={styles.footerLoader}>
        <ActivityIndicator color={COLORS.primary} />
      </View>
    ) : null;

  const showSkeleton = loading && items === null;
  const showError = !!error && items === null;
  const hasItems = (items?.length ?? 0) > 0;

  const renderToolbar = () => {
    if (!hasItems) {
      return null;
    }
    if (selectMode) {
      return (
        <View style={styles.toolbar}>
          <Pressable onPress={toggleSelectAll} hitSlop={8} style={styles.markAllBtn}>
            <AppText style={styles.markAllText}>
              {allSelected ? 'Clear all' : 'Select all'}
            </AppText>
          </Pressable>
          <View style={styles.toolbarActions}>
            <AppText style={styles.toolbarText}>{selected.length} selected</AppText>
            <Pressable
              onPress={() => setPrompt('deleteSelected')}
              disabled={selected.length === 0}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Delete selected"
              style={styles.markAllBtn}>
              <AppText
                style={[
                  styles.dangerText,
                  selected.length === 0 && styles.actionDisabled,
                ]}>
                Delete
              </AppText>
            </Pressable>
            <Pressable onPress={exitSelectMode} hitSlop={8} style={styles.markAllBtn}>
              <AppText style={styles.markAllText}>Cancel</AppText>
            </Pressable>
          </View>
        </View>
      );
    }
    return (
      <View style={styles.toolbar}>
        <AppText style={styles.toolbarText}>
          {unreadCount > 0
            ? `${unreadCount} unread notification${unreadCount === 1 ? '' : 's'}`
            : 'All caught up'}
        </AppText>
        <View style={styles.toolbarActions}>
          {unreadCount > 0 ? (
            <Pressable
              onPress={onMarkAllRead}
              disabled={markingAll}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Mark all as read"
              style={styles.markAllBtn}>
              <AppText style={[styles.markAllText, markingAll && styles.actionDisabled]}>
                Mark all read
              </AppText>
            </Pressable>
          ) : null}
          <Pressable
            onPress={() => setSelectMode(true)}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Select notifications"
            style={styles.markAllBtn}>
            <AppText style={styles.markAllText}>Select</AppText>
          </Pressable>
          <Pressable
            onPress={() => setPrompt('deleteAll')}
            disabled={deletingAll}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Delete all notifications"
            style={styles.markAllBtn}>
            <AppText style={[styles.dangerText, deletingAll && styles.actionDisabled]}>
              Clear all
            </AppText>
          </Pressable>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.safe}>
      <AppHeader variant="back" title="Notifications" />

      {renderToolbar()}

      {showSkeleton ? (
        renderSkeleton()
      ) : showError ? (
        renderError()
      ) : (
        <FlatList
          data={items ?? []}
          keyExtractor={item => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.body}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={load}
              colors={[COLORS.primary]}
              tintColor={COLORS.primary}
            />
          }
          onEndReachedThreshold={0.4}
          onEndReached={onEndReached}
          ListEmptyComponent={renderEmpty}
          ListFooterComponent={renderFooter}
        />
      )}

      <ConfirmDialog
        visible={prompt !== null}
        tone="danger"
        icon={ICONS.DELETE}
        title={prompt === 'deleteAll' ? 'Delete all notifications' : 'Delete notifications'}
        message={
          prompt === 'deleteAll'
            ? 'This removes every notification from your list. It cannot be undone.'
            : `Delete ${selected.length} notification${selected.length === 1 ? '' : 's'}? This cannot be undone.`
        }
        confirmLabel="Delete"
        cancelLabel="Cancel"
        onConfirm={confirmPrompt}
        onClose={() => setPrompt(null)}
      />
    </View>
  );
};

export default NotificationsScreen;
