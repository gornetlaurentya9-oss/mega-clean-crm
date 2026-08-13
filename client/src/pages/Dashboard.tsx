import { Card } from "../components/ui";

export default function Dashboard() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-gray-900">Overview</h1>
      <Card>
        <p className="text-gray-600">You're logged in. More is coming to this dashboard soon.</p>
      </Card>
    </div>
  );
}
