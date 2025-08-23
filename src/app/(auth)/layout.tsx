export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-900">ТУУШИН ХХК</h1>
          <p className="mt-2 text-sm text-gray-600">Freight Management System</p>
        </div>
        {children}
      </div>
    </div>
  );
}
