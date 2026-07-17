import type { CSSProperties } from "react";
import toast, { type ToasterProps } from "react-hot-toast";

const PALETTE = {
  success: "#2BA745",
  danger: "#E53935",
  info: "#207DD2",
  gray900: "#212829",
  white: "#FFFFFF",
};

const baseStyle: CSSProperties = {
  borderRadius: "10px",
  padding: "12px 16px",
  fontSize: "14px",
  fontWeight: 500,
  color: PALETTE.gray900,
  boxShadow: "0 4px 12px rgba(16, 24, 40, 0.12)",
  border: "1px solid #DEE2E6",
  maxWidth: "420px",
};

export const toasterProps: ToasterProps = {
  position: "top-right",
  gutter: 10,
  toastOptions: {
    duration: 4000,
    style: baseStyle,
    success: {
      iconTheme: { primary: PALETTE.success, secondary: PALETTE.white },
      style: { ...baseStyle, borderColor: PALETTE.success },
    },
    error: {
      iconTheme: { primary: PALETTE.danger, secondary: PALETTE.white },
      style: { ...baseStyle, borderColor: PALETTE.danger },
    },
  },
};

export function showSuccess(message: string): void {
  toast.success(message);
}

export function showError(message: string): void {
  toast.error(message);
}

export function showInfo(message: string): void {
  toast(message, {
    icon: "ℹ️",
    style: { ...baseStyle, borderColor: PALETTE.info },
  });
}

export { toast };
