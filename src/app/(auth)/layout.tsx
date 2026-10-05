import Image from 'next/image';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <Image
            src="/tuushin_logo.png"
            alt="Tuushin logo"
            width={596}
            height={141}
            className="mx-auto h-14 w-auto"
            priority
          />
        </div>
        {children}
      </div>
    </div>
  );
}
