import { ConsentGateApp } from "@/components/consentgate/consentgate-app";

export default async function RequestDetailRoute({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ConsentGateApp mode="request-detail" recordId={decodeURIComponent(id)} />;
}
