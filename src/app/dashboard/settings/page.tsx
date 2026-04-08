export default function SettingsPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
      <p className="text-sm text-gray-600">Settings — coming soon</p>
      <div className="rounded-xl border border-gray-200 bg-white p-6">
        <p className="text-sm font-medium text-gray-900">
          Planned configuration (future)
        </p>
        <ul className="mt-3 list-inside list-disc space-y-1 text-sm text-gray-600">
          <li>Back office notification email address</li>
          <li>Default driver assignment rules</li>
          <li>Delivery time windows</li>
        </ul>
      </div>
    </div>
  );
}
