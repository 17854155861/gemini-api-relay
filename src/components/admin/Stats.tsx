'use client';

interface StatsProps {
  title: string;
  value: string | number;
  description?: string;
}

export function Stats({ title, value, description }: StatsProps) {
  return (
    <div className="bg-white p-6 rounded-lg border shadow-sm">
      <div className="text-sm font-medium text-gray-500">{title}</div>
      <div className="text-2xl font-bold mt-1">{value}</div>
      {description && (
        <div className="text-xs text-gray-400 mt-1">{description}</div>
      )}
    </div>
  );
}
