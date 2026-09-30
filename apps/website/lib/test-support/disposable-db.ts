export function requireDisposableDatabase() {
  const url = process.env.DATABASE_URL;
  if (!url || url !== process.env.HOIWORK_TEST_DATABASE_URL) {
    throw new Error("O teste exige HOIWORK_TEST_DATABASE_URL igual a DATABASE_URL.");
  }
  const parsed = new URL(url);
  if (
    !["127.0.0.1", "localhost"].includes(parsed.hostname) ||
    parsed.pathname !== "/hoiwork_test"
  ) {
    throw new Error("O teste só pode usar o banco local descartável hoiwork_test.");
  }
}
