import { Fragment } from "react";
import { Link } from "react-router-dom";

export interface Crumb {
  label: string;
  to?: string;
  state?: unknown;
}

export default function Breadcrumbs({
  items,
  className = "",
}: {
  items: Crumb[];
  className?: string;
}) {
  return (
    <nav aria-label="Breadcrumb" className={className}>
      <ol className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-gray-500">
        {items.map((item, i) => (
          <Fragment key={i}>
            {i > 0 && (
              <li aria-hidden="true" className="text-gray-300">
                /
              </li>
            )}
            <li className="min-w-0 max-w-[18rem] truncate">
              {item.to ? (
                <Link
                  to={item.to}
                  state={item.state}
                  className="font-medium hover:text-primary"
                >
                  {item.label}
                </Link>
              ) : (
                <span aria-current="page" className="font-semibold text-gray-700">
                  {item.label}
                </span>
              )}
            </li>
          </Fragment>
        ))}
      </ol>
    </nav>
  );
}
