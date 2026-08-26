export type ConnectorFailureCategory =
  | "CONNECTIVITY"
  | "AUTHENTICATION"
  | "AUTHORIZATION"
  | "TLS"
  | "API"
  | "PROTOCOL"
  | "CONFIGURATION"
  | "UNKNOWN";

export type ConnectorFailureReason =
  | "HOST_UNREACHABLE"
  | "CONNECTION_TIMEOUT"
  | "CONNECTION_REFUSED"
  | "AUTH_FAILED"
  | "PERMISSION_DENIED"
  | "TLS_ERROR"
  | "RATE_LIMIT"
  | "API_ERROR"
  | "INVALID_RESPONSE"
  | "CONFIGURATION_ERROR"
  | "UNKNOWN_CONNECTOR_ERROR";

export type ConnectorFailureSeverity =
  | "INFO"
  | "WARNING"
  | "CRITICAL";

export type ConnectorFailureClassification = {
  version: "015.6.11.7.2.1";
  category: ConnectorFailureCategory;
  reason: ConnectorFailureReason;
  severity: ConnectorFailureSeverity;
  retryable: boolean;
  recoverable: boolean;
  httpStatus: number | null;
  networkCode: string | null;
  rawMessage: string;
  recommendedAction: string;
  evidence: {
    matchedBy: string[];
    sourceName: string | null;
    sourceCode: string | null;
  };
};

function asErrorLike(error: unknown) {
  if (error instanceof Error) {
    const extended = error as Error & {
      code?: string;
      status?: number;
      statusCode?: number;
      cause?: unknown;
    };

    return {
      name: error.name || null,
      message: error.message || String(error),
      code:
        typeof extended.code === "string"
          ? extended.code.toUpperCase()
          : null,
      status:
        typeof extended.status === "number"
          ? extended.status
          : typeof extended.statusCode === "number"
            ? extended.statusCode
            : null,
    };
  }

  if (typeof error === "string") {
    return {
      name: null,
      message: error,
      code: null,
      status: null,
    };
  }

  if (error && typeof error === "object") {
    const value = error as Record<string, unknown>;

    return {
      name: typeof value.name === "string" ? value.name : null,
      message:
        typeof value.message === "string"
          ? value.message
          : JSON.stringify(value),
      code:
        typeof value.code === "string"
          ? value.code.toUpperCase()
          : null,
      status:
        typeof value.status === "number"
          ? value.status
          : typeof value.statusCode === "number"
            ? value.statusCode
            : null,
    };
  }

  return {
    name: null,
    message: String(error),
    code: null,
    status: null,
  };
}

function extractHttpStatus(message: string, explicit: number | null) {
  if (explicit !== null) return explicit;

  const patterns = [
    /\bHTTP\s+(\d{3})\b/i,
    /\bstatus(?:Code)?[=: ]+(\d{3})\b/i,
  ];

  for (const pattern of patterns) {
    const match = message.match(pattern);
    if (match) return Number(match[1]);
  }

  return null;
}

function extractNetworkCode(message: string, explicit: string | null) {
  if (explicit) return explicit;

  const known = [
    "EHOSTUNREACH",
    "ENETUNREACH",
    "ETIMEDOUT",
    "ECONNREFUSED",
    "ECONNRESET",
    "EPIPE",
  ];

  const upper = message.toUpperCase();
  return known.find((code) => upper.includes(code)) ?? null;
}

function includesAny(value: string, patterns: string[]) {
  const lower = value.toLowerCase();
  return patterns.some((pattern) => lower.includes(pattern.toLowerCase()));
}

export function classifyConnectorFailure(
  error: unknown,
): ConnectorFailureClassification {
  const source = asErrorLike(error);
  const message = source.message || "Falha desconhecida.";
  const httpStatus = extractHttpStatus(message, source.status);
  const networkCode = extractNetworkCode(message, source.code);
  const matchedBy: string[] = [];

  const result = (
    category: ConnectorFailureCategory,
    reason: ConnectorFailureReason,
    severity: ConnectorFailureSeverity,
    retryable: boolean,
    recoverable: boolean,
    recommendedAction: string,
  ): ConnectorFailureClassification => ({
    version: "015.6.11.7.2.1",
    category,
    reason,
    severity,
    retryable,
    recoverable,
    httpStatus,
    networkCode,
    rawMessage: message,
    recommendedAction,
    evidence: {
      matchedBy,
      sourceName: source.name,
      sourceCode: source.code,
    },
  });

  if (
    networkCode === "EHOSTUNREACH" ||
    networkCode === "ENETUNREACH"
  ) {
    matchedBy.push(networkCode);
    return result(
      "CONNECTIVITY",
      "HOST_UNREACHABLE",
      "CRITICAL",
      true,
      true,
      "Verificar energia, conectividade, rota, VLAN/VPN e disponibilidade do host.",
    );
  }

  if (
    networkCode === "ETIMEDOUT" ||
    includesAny(message, [
      "timeout ao acessar",
      "timeout no endpoint",
      "timed out",
      "connection timeout",
    ])
  ) {
    matchedBy.push(networkCode ?? "TIMEOUT_MESSAGE");
    return result(
      "CONNECTIVITY",
      "CONNECTION_TIMEOUT",
      "CRITICAL",
      true,
      true,
      "Verificar latência, perda de pacotes, firewall e disponibilidade do endpoint.",
    );
  }

  if (networkCode === "ECONNREFUSED") {
    matchedBy.push(networkCode);
    return result(
      "CONNECTIVITY",
      "CONNECTION_REFUSED",
      "CRITICAL",
      true,
      true,
      "Verificar se o serviço está ativo, escutando na porta configurada e liberado no firewall.",
    );
  }

  if (httpStatus === 401) {
    matchedBy.push("HTTP_401");
    return result(
      "AUTHENTICATION",
      "AUTH_FAILED",
      "CRITICAL",
      false,
      true,
      "Validar token, usuário, segredo e formato da credencial antes de repetir.",
    );
  }

  if (httpStatus === 403) {
    matchedBy.push("HTTP_403");
    return result(
      "AUTHORIZATION",
      "PERMISSION_DENIED",
      "CRITICAL",
      false,
      true,
      "Revisar ACLs e privilégios necessários no Proxmox antes de nova tentativa.",
    );
  }

  if (
    includesAny(message, [
      "certificate",
      "self signed",
      "self-signed",
      "unable to verify",
      "tls",
      "ssl",
      "cert_has_expired",
      "unable_to_verify_leaf_signature",
      "depth_zero_self_signed_cert",
    ])
  ) {
    matchedBy.push("TLS_MESSAGE");
    return result(
      "TLS",
      "TLS_ERROR",
      "CRITICAL",
      false,
      true,
      "Validar cadeia de certificados, validade, hostname e política allowSelfSigned.",
    );
  }

  if (httpStatus === 429) {
    matchedBy.push("HTTP_429");
    return result(
      "API",
      "RATE_LIMIT",
      "WARNING",
      true,
      true,
      "Aplicar backoff e reduzir frequência de chamadas antes de repetir.",
    );
  }

  if (httpStatus !== null && httpStatus >= 500) {
    matchedBy.push(`HTTP_${httpStatus}`);
    return result(
      "API",
      "API_ERROR",
      "CRITICAL",
      true,
      true,
      "Verificar saúde do serviço Proxmox e repetir somente após recuperação do endpoint.",
    );
  }

  if (
    includesAny(message, [
      "resposta inválida",
      "invalid response",
      "unexpected token",
      "json",
      "parse",
    ])
  ) {
    matchedBy.push("INVALID_RESPONSE_MESSAGE");
    return result(
      "PROTOCOL",
      "INVALID_RESPONSE",
      "WARNING",
      false,
      true,
      "Inspecionar resposta bruta, proxy intermediário e compatibilidade da API.",
    );
  }

  if (
    includesAny(message, [
      "não configurada",
      "not configured",
      "missing configuration",
      "invalid url",
      "invalid endpoint",
    ])
  ) {
    matchedBy.push("CONFIGURATION_MESSAGE");
    return result(
      "CONFIGURATION",
      "CONFIGURATION_ERROR",
      "CRITICAL",
      false,
      true,
      "Corrigir endpoint, token e demais parâmetros de configuração antes de repetir.",
    );
  }

  if (httpStatus !== null && httpStatus >= 400) {
    matchedBy.push(`HTTP_${httpStatus}`);
    return result(
      "API",
      "API_ERROR",
      "CRITICAL",
      false,
      true,
      "Inspecionar código HTTP e resposta da API antes de nova tentativa.",
    );
  }

  matchedBy.push("NO_RULE_MATCH");
  return result(
    "UNKNOWN",
    "UNKNOWN_CONNECTOR_ERROR",
    "CRITICAL",
    false,
    false,
    "Preservar a evidência bruta e encaminhar para diagnóstico manual antes de nova ação.",
  );
}
