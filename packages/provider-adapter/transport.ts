export type ProviderTransport = "encrypted-allowlisted";

export interface ProviderTransportConfig {
  transport: ProviderTransport;
  host: string;
  port?: number;
  allowRawTcp?: boolean;
}

export function assertEncryptedTransport(config: ProviderTransportConfig): true {
  if (config.transport !== "encrypted-allowlisted") {
    const error = new Error("Production provider transport must be encrypted-allowlisted.");
    (error as Error & { code: string }).code = "transport-forbidden";
    throw error;
  }
  if (config.host === "moss.stanford.edu" && config.port === 7690 && config.allowRawTcp === true) {
    const error = new Error("Raw public Moss TCP is forbidden for product traffic.");
    (error as Error & { code: string }).code = "raw-tcp-forbidden";
    throw error;
  }
  return true;
}

export function assertNumericUserId(userId: string): true {
  if (!/^[0-9]{3,}$/.test(userId)) {
    const error = new Error("Moss userid must be numeric.");
    (error as Error & { code: string }).code = "userid-format";
    throw error;
  }
  return true;
}
