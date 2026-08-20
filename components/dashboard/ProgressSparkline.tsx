export function ProgressSparkline({
  values,
  label
}: {
  values: number[];
  label: string;
}) {
  if (values.length < 2) return null;

  const width = 240;
  const height = 64;
  const padding = 5;
  const minimum = Math.min(...values);
  const maximum = Math.max(...values);
  const spread = maximum - minimum || 1;
  const points = values
    .map((value, index) => {
      const x = padding + (index / (values.length - 1)) * (width - padding * 2);
      const y = height - padding - ((value - minimum) / spread) * (height - padding * 2);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  const first = points.split(" ")[0].split(",");
  const last = points.split(" ").at(-1)!.split(",");

  return (
    <svg
      aria-label={label}
      className="progress-sparkline"
      preserveAspectRatio="none"
      role="img"
      viewBox={`0 0 ${width} ${height}`}
    >
      <line
        className="progress-sparkline-baseline"
        x1={padding}
        x2={width - padding}
        y1={height - padding}
        y2={height - padding}
      />
      <polyline className="progress-sparkline-line" fill="none" points={points} />
      <circle className="progress-sparkline-dot" cx={first[0]} cy={first[1]} r="3" />
      <circle className="progress-sparkline-dot current" cx={last[0]} cy={last[1]} r="4" />
    </svg>
  );
}
