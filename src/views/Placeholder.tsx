export function Placeholder({ title, text }: { title: string; text: string }) {
  return (
    <section className="blankslate">
      <h1 className="page-title">{title}</h1>
      <p className="text-muted">{text}</p>
    </section>
  );
}
