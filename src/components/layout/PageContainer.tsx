interface PageContainerProps {
  children: React.ReactNode;
  className?: string;
}

export default function PageContainer({
  children,
  className = "",
}: PageContainerProps) {
  return (
    <main
      className={`
        min-h-[calc(100vh-var(--ds-header-height))]
        w-full
        px-4
        py-7
        sm:px-7
        lg:px-10
        ${className}
      `}
    >
      <div className="mx-auto w-full max-w-[var(--ds-content-max-width)]">
        {children}
      </div>
    </main>
  );
}
