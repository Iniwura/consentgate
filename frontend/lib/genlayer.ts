import { createClient } from "genlayer-js";
import { studioDevnet } from "genlayer-js/chains";
import type { Address } from "viem";

import { studioDevConfig } from "@/lib/config";
import type { Eip1193Provider } from "@/lib/types";

const studioDevChain = {
  ...studioDevnet,
  id: studioDevConfig.chainId,
  name: studioDevConfig.networkName,
  rpcUrls: { default: { http: [studioDevConfig.rpcUrl] as readonly string[] } },
} as typeof studioDevnet;

let readClient: ReturnType<typeof createClient> | undefined;

export function getReadClient() {
  readClient ??= createClient({ chain: studioDevChain });
  return readClient;
}

export function getWriteClient(
  address: Address,
  provider: Eip1193Provider,
) {
  type ClientProvider = NonNullable<
    NonNullable<Parameters<typeof createClient>[0]>["provider"]
  >;
  return createClient({
    chain: studioDevChain,
    account: address,
    provider: provider as ClientProvider,
  });
}
