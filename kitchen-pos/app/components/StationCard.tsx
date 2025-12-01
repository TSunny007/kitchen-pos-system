"use client";

import Link from "next/link";

interface StationCardProps {
  title: string;
  description: string;
  href: string;
  icon: React.ReactNode;
}

export default function StationCard({
  title,
  description,
  href,
  icon,
}: StationCardProps) {
  return (
    <Link
      href={href}
      className="group flex flex-col items-center rounded-2xl border border-outline-variant bg-surface-container p-8 text-center transition-all hover:border-primary hover:bg-surface-container-high hover:shadow-lg active:scale-[0.98]"
    >
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary-container text-on-primary-container transition-colors group-hover:bg-primary group-hover:text-on-primary">
        {icon}
      </div>
      <h2 className="mb-2 text-xl font-semibold text-on-surface">{title}</h2>
      <p className="text-sm text-on-surface-variant">{description}</p>
    </Link>
  );
}
