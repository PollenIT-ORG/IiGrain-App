import { FileIcon } from "../components/icons";

export default function Placeholder({ title }: { title: string }) {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
      <div className="card grid place-items-center px-6 py-20 text-center">
        <span className="mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-primary/10 text-primary">
          <FileIcon width={28} height={28} />
        </span>
        <h2 className="text-lg font-semibold text-gray-900">
          {title} coming soon
        </h2>
        <p className="mt-1 max-w-sm text-sm text-gray-500">
          This section is part of the upcoming modules. The dashboard is live;
          this screen is a placeholder for now.
        </p>
      </div>
    </div>
  );
}
