export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#092F2B] p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-[#079B50] mb-4">
            <span className="text-2xl font-bold text-white">F</span>
          </div>
          <h1 className="text-3xl font-bold text-white">FarmFlow</h1>
          <p className="text-emerald-200 mt-2 text-base">
            Multi-Branch Chicken Shop Management
          </p>
        </div>
        <div className="bg-white rounded-2xl border border-[#E5E7EB] shadow-xl p-8">
          {children}
        </div>
      </div>
    </div>
  );
}
