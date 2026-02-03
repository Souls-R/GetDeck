export default function DeckLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 overflow-auto bg-[var(--background)]">
      {children}
    </div>
  );
}
