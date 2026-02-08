export function FloatingActionButton({ onClick }: { onClick: () => void }) {
  return (
    <button onClick={onClick} className="fixed bottom-6 right-6 h-14 w-14 rounded-full bg-primary text-2xl text-white shadow-soft">+</button>
  );
}

