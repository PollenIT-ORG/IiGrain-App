import { useSyncOwner } from '../hooks/useSyncOwner';

interface Props {
  databaseReady: boolean;
}

const SyncOwnerBridge = ({ databaseReady }: Props): null => {
  useSyncOwner(databaseReady);
  return null;
};

export default SyncOwnerBridge;
