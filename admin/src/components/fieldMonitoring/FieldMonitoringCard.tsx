import FieldMonitoringPanel from "./FieldMonitoringPanel";

/** The field's monitoring record, as a card on the field's own page. */
export default function FieldMonitoringCard({ fieldId }: { fieldId: string }) {
  if (!fieldId) return null;
  return <FieldMonitoringPanel fieldId={fieldId} heading="Field Monitoring" />;
}
