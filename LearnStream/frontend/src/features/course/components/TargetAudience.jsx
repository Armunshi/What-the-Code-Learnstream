export function TargetAudience({ audience = [] }) {
  if (audience.length === 0) return null;

  return (
    <section>
      <h2 className="text-lg font-semibold text-foreground">Who this course is for</h2>
      <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-foreground">
        {audience.map((item, index) => (
          <li key={index}>{item}</li>
        ))}
      </ul>
    </section>
  );
}

export default TargetAudience;
