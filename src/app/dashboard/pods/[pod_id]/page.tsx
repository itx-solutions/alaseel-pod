import Link from "next/link";
import { Button } from "@/components/ui/button";

export default async function PodPlaceholderPage({
  params,
}: {
  params: Promise<{ pod_id: string }>;
}) {
  const { pod_id } = await params;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">POD record</h1>
        <p className="mt-1 font-mono text-sm text-gray-500">{pod_id}</p>
        <p className="mt-4 text-sm text-gray-600">
          Full POD viewing (signature, photos, map) will ship in a later
          milestone. This route confirms navigation from order detail works.
        </p>
      </div>
      <Button variant="outline" asChild>
        <Link href="/dashboard/pods">Back to POD list</Link>
      </Button>
    </div>
  );
}
