import { ConsentGateApp } from "@/components/consentgate/consentgate-app";

export default async function PolicyDetailRoute({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ConsentGateApp mode="policy-detail" recordId={decodeURIComponent(id)} />;
}
