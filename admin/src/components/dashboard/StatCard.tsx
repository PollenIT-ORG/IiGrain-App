import type { ComponentType, SVGProps } from "react";
import { TrendUpIcon, TrendDownIcon } from "../icons";

type ColorKey = "primary" | "secondary" | "info" | "accent" | "success";

const tints: Record<ColorKey, string> = {
  primary: "bg-primary/10 text-primary",
  secondary: "bg-secondary/10 text-secondary",
  info: "bg-info/10 text-info",
  accent: "bg-accent/10 text-accent",
  success: "bg-success/10 text-success",
};

interface StatCardProps {
  label: string;
  value: string;
  change?: string;
  changeLabel?: string;
  Icon: ComponentType<SVGProps<SVGSVGElement>>;
  color?: ColorKey;
}

export default function StatCard({
  label,
  value,
  change,
  changeLabel = "vs last month",
  Icon,
  color = "primary",
}: StatCardProps) {
  const isUp = change ? !change.trim().startsWith("-") : true;

  return (
    <div className="card p-5 transition-shadow hover:shadow-card-hover">
      <div className="flex items-start justify-between">
        <span
          className={`grid h-11 w-11 place-items-center rounded-xl ${tints[color]}`}
        >
          <Icon width={22} height={22} />
        </span>
        {change && (
          <span
            className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-semibold ${
              isUp
                ? "bg-success/10 text-success"
                : "bg-danger/10 text-danger"
            }`}
          >
            {isUp ? (
              <TrendUpIcon width={13} height={13} />
            ) : (
              <TrendDownIcon width={13} height={13} />
            )}
            {change}
          </span>
        )}
      </div>

      <p className="mt-4 text-2xl font-bold text-gray-900 sm:text-3xl">
        {value}
      </p>
      <p className="mt-1 text-sm text-gray-500">{label}</p>
      {change && (
        <p className="mt-2 text-xs text-gray-500">{changeLabel}</p>
      )}
    </div>
  );
}
