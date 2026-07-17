import { LeafIcon } from "./icons";

interface LogoProps {
  size?: "sm" | "md" | "lg";
  withText?: boolean;
  light?: boolean;
}

const badgeSizes = {
  sm: "h-8 w-8 rounded-lg",
  md: "h-10 w-10 rounded-xl",
  lg: "h-12 w-12 rounded-xl",
};
const iconSizes = { sm: 18, md: 22, lg: 26 };
const textSizes = { sm: "text-base", md: "text-lg", lg: "text-xl" };

export default function Logo({
  size = "md",
  withText = true,
  light = false,
}: LogoProps) {
  return (
    <div className="flex items-center gap-2.5">
      <span
        className={`grid place-items-center bg-primary text-white shadow-card ${badgeSizes[size]}`}
      >
        <LeafIcon width={iconSizes[size]} height={iconSizes[size]} />
      </span>
      {withText && (
        <span
          className={`font-extrabold tracking-tight ${textSizes[size]} ${
            light ? "text-white" : "text-gray-900"
          }`}
        >
          Farmer<span className="text-secondary">App</span>
        </span>
      )}
    </div>
  );
}
