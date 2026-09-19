export function Requirements({ requirements = [] }) {
  if (requirements.length === 0) return null;

  return (
    <section>
      <h2 className="text-lg font-semibold text-foreground">Requirements</h2>
      <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-foreground">
        {requirements.map((requirement, index) => (
          <li key={index}>{requirement}</li>
        ))}
      </ul>
    </section>
  );
}

export default Requirements;
