export function Placeholder({ title, text }: { title: string; text: string }) {
  return (
    <section className="placeholder">
      <h1 className="screen-title">{title}</h1>
      <p>{text}</p>
    </section>
  );
}
