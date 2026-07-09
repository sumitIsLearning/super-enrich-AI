import { HTMLAttributes } from "react";

export default function FirecrawlIcon({
  fill = "var(--heat-100)",
  ...attrs
}: HTMLAttributes<HTMLOrSVGElement> & { fill?: string }) {
  return (
    <svg
      {...attrs}
      viewBox="0 0 100 100"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M72 26C72 26 45 14 30 27C15 40 22 50 50 50C78 50 85 60 70 73C55 86 28 74 28 74"
        fill="none"
        stroke={fill}
        strokeLinecap="round"
        strokeWidth="14"
      />
    </svg>
  );
}
