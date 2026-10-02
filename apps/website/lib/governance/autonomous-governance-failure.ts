export type GovernanceFailureCode =
  | "DATABASE_UNAVAILABLE"
  | "DATABASE_TIMEOUT"
  | "DATABASE_ERROR"
  | "DEPENDENCY_UNAVAILABLE"
  | "DEPENDENCY_TIMEOUT"
  | "INTERRUPTED"
  | "EVALUATION_FAILED";

const messages: Record<GovernanceFailureCode, string> = {
  DATABASE_UNAVAILABLE: "Banco de dados indisponível.",
  DATABASE_TIMEOUT: "Tempo limite ao consultar o banco de dados.",
  DATABASE_ERROR: "Falha ao acessar o banco de dados.",
  DEPENDENCY_UNAVAILABLE: "Dependência indisponível durante a avaliação.",
  DEPENDENCY_TIMEOUT: "Tempo limite ao consultar uma dependência.",
  INTERRUPTED: "Execução interrompida; o scheduler retomará a avaliação.",
  EVALUATION_FAILED: "Falha na avaliação da governança.",
};

/** Never persist or return an exception message from the scheduler. */
export function classifyGovernanceFailure(error: unknown): GovernanceFailureCode {
  const code = error && typeof error === "object" && "code" in error
    ? (error as { code: unknown }).code
    : null;
  if (typeof code !== "string") return "EVALUATION_FAILED";
  if (["P1001", "08001", "08006", "57P01"].includes(code)) {
    return "DATABASE_UNAVAILABLE";
  }
  if (["P1002", "P2024", "57014"].includes(code)) {
    return "DATABASE_TIMEOUT";
  }
  if (["ECONNREFUSED", "ENOTFOUND", "EHOSTUNREACH"].includes(code)) return "DEPENDENCY_UNAVAILABLE";
  if (code === "ETIMEDOUT") return "DEPENDENCY_TIMEOUT";
  if (/^P\d{4}$/.test(code) || /^[A-Z0-9]{5}$/.test(code)) return "DATABASE_ERROR";
  return "EVALUATION_FAILED";
}

export function publicGovernanceFailure(code: string | null): string | null {
  if (code === null) return null;
  return Object.prototype.hasOwnProperty.call(messages, code)
    ? messages[code as GovernanceFailureCode]
    : "Falha anterior da automação; consulte os logs do HOIWORK.";
}
