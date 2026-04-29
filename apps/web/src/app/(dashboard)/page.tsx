export default function DashboardPage() {
  return (
    <div className="p-8">
      <h1 className="text-2xl font-semibold text-gray-900 mb-2">Dashboard</h1>
      <p className="text-sm text-gray-500 mb-8">Phase 1 complete — foundation is running.</p>
      <div className="grid grid-cols-3 gap-6">
        {[
          { label: 'Active Agents', value: '0', hint: 'Configure in Phase 2' },
          { label: 'Conversations', value: '0', hint: 'Live in Phase 5' },
          { label: 'Appointments', value: '0', hint: 'Live in Phase 4' },
        ].map((card) => (
          <div key={card.label} className="bg-white rounded-xl border border-gray-200 p-6">
            <p className="text-sm text-gray-500">{card.label}</p>
            <p className="text-3xl font-bold text-gray-900 mt-1">{card.value}</p>
            <p className="text-xs text-gray-400 mt-2">{card.hint}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
