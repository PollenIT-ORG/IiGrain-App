import { useEffect, useState } from "react";
import PdfDocument from "./PdfDocument";
import { fetchApiPdf } from "../lib/openPdf";
import { errMsg } from "../lib/errMsg";

/**
 * A contract drawn on the page, exactly as a producer will read it.
 *
 * An uploaded contract is its own PDF; a written one is laid out by the server
 * into the same document. Either way this shows the pages themselves, with no
 * browser toolbar or download bar around them.
 */
export default function ContractPdfPreview({
  contractId,
  className,
}: {
  contractId: string;
  className?: string;
}) {
  const [bytes, setBytes] = useState<Uint8Array | null>(null);
  const [failed, setFailed] = useState<string | null>(null);

  useEffect(() => {
    let dropped = false;
    setBytes(null);
    setFailed(null);
    void (async () => {
      try {
        const pdf = await fetchApiPdf(
          `/program-admin-surveys/contracts/${contractId}/pdf`
        );
        if (!dropped) setBytes(pdf);
      } catch (err) {
        if (!dropped) setFailed(errMsg(err));
      }
    })();
    return () => {
      dropped = true;
    };
  }, [contractId]);

  return (
    <PdfDocument
      data={bytes}
      className={className ?? "h-[32rem]"}
      placeholder={
        failed ? (
          <span className="text-danger">{failed}</span>
        ) : (
          <span>Loading the contract...</span>
        )
      }
    />
  );
}
