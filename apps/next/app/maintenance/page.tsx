export const metadata = {
  title: 'Maintenance | JomContest',
  description: 'JomContest is temporarily unavailable for maintenance.',
}

export default function MaintenancePage() {
  return (
    <main className="fixed inset-0 bg-white dark:bg-black flex items-center justify-center px-6">
      <div className="max-w-xl text-center">
        <div className="text-5xl md:text-6xl mb-6" aria-hidden="true">🔧</div>
        <h1 className="text-3xl md:text-4xl font-bold mb-3">
          We&apos;ll be back soon
        </h1>
        <p className="text-muted-foreground text-base md:text-lg">
          JomContest is temporarily unavailable while we perform maintenance.
          Please try again shortly.
        </p>
      </div>
    </main>
  )
}
