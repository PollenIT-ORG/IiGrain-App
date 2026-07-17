import PhoneInputLib from "react-phone-number-input";
import "react-phone-number-input/style.css";
import "./phone-input.css";

interface PhoneInputProps {
  value: string;
  onChange: (value: string) => void;
  id?: string;
  placeholder?: string;
  disabled?: boolean;
}

export default function PhoneInput({
  value,
  onChange,
  id,
  placeholder = "Enter mobile number",
  disabled = false,
}: PhoneInputProps) {
  return (
    <PhoneInputLib
      id={id}
      international
      defaultCountry="US"
      countryCallingCodeEditable={false}
      value={value || undefined}
      onChange={(v) => onChange(v ?? "")}
      placeholder={placeholder}
      disabled={disabled}
      className="fa-phone-input"
    />
  );
}
