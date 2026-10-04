/* eslint-disable @next/next/no-img-element -- local SVG logo; next/image's optimizer
   rejects SVGs unless images.dangerouslyAllowSVG is set, so a plain <img> is simplest. */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <img src="/logo-tuushin.svg" alt="Tuushin logo" className="mx-auto h-10 w-auto" />
          <h1 className="mt-4 text-3xl font-bold text-gray-900">ТУУШИН ХХК</h1>
          <p className="mt-2 text-sm text-gray-600">Freight Management System</p>
        </div>
        {children}
      </div>
    </div>
  );
}
