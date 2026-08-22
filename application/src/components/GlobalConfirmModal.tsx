import React, { useCallback, useEffect, useRef, useState } from 'react';
import ConfirmationModal from './modals/ConfirmationModal/ConfirmationModal';
import { setConfirmHandler, type ConfirmRequest } from '../services/confirmService';

const GlobalConfirmModal: React.FC = () => {
  const [request, setRequest] = useState<ConfirmRequest | null>(null);

  const lastRef = useRef<ConfirmRequest | null>(null);
  if (request) {
    lastRef.current = request;
  }

  useEffect(() => {
    setConfirmHandler(setRequest);
    return () => setConfirmHandler(null);
  }, []);

  const answer = useCallback(
    (confirmed: boolean) => {
      request?.resolve(confirmed);
    },
    [request],
  );

  const onConfirm = useCallback(() => answer(true), [answer]);
  const onCancel = useCallback(() => answer(false), [answer]);

  const shown = request ?? lastRef.current;
  if (!shown) {
    return null;
  }

  return (
    <ConfirmationModal
      visible={request !== null}
      title={shown.title}
      message={shown.message}
      consequences={shown.consequences}
      icon={shown.icon}
      tone={shown.tone}
      confirmLabel={shown.confirmLabel ?? (shown.acknowledgeOnly ? 'OK' : 'Confirm')}
      cancelLabel={shown.cancelLabel ?? 'Cancel'}
      hideCancel={shown.acknowledgeOnly}
      onConfirm={onConfirm}
      onCancel={onCancel}
    />
  );
};

export default GlobalConfirmModal;
