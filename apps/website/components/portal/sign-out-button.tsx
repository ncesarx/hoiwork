import { endPortalSession } from "@/app/portal/actions";
import styles from "./sign-out-button.module.css";

export function SignOutButton() {
  return <form action={endPortalSession} className={styles.form}>
    <button className={styles.button} type="submit">Sair</button>
  </form>;
}
