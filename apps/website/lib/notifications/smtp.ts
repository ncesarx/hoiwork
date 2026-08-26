import nodemailer from "nodemailer";

export type SmtpConnectorConfig = {
  host?: string;
  port?: number;
  secure?: boolean;
  user?: string;
  from?: string;
  tlsServername?: string;
  rejectUnauthorized?: boolean;
};

export function smtpConfig(value: unknown): SmtpConnectorConfig {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as SmtpConnectorConfig;
}

export function createSmtpTransport(config: SmtpConnectorConfig, password?: string) {
  if (!config.host) throw new Error("SMTP host não configurado.");
  if (!config.port) throw new Error("SMTP port não configurada.");
  if (!config.from) throw new Error("SMTP from não configurado.");

  return nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: Boolean(config.secure),
    auth: config.user ? { user: config.user, pass: password } : undefined,
    tls: {
      ...(config.tlsServername ? { servername: config.tlsServername } : {}),
      rejectUnauthorized: config.rejectUnauthorized !== false,
    },
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 15000,
  });
}

export async function verifySmtp(config: SmtpConnectorConfig, password?: string) {
  const transport = createSmtpTransport(config, password);
  await transport.verify();
  transport.close();
}

export async function sendSmtpMail(input: {
  config: SmtpConnectorConfig;
  password?: string;
  to: string;
  subject: string;
  text: string;
}) {
  const transport = createSmtpTransport(input.config, input.password);

  const info = await transport.sendMail({
    from: input.config.from,
    to: input.to,
    subject: input.subject,
    text: input.text,
  });

  transport.close();

  return {
    messageId: info.messageId,
    accepted: info.accepted,
    rejected: info.rejected,
    response: info.response,
  };
}
