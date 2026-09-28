import Link from "next/link";
import type { ManualSectionId } from "@/app/portal/ajuda/manual";
import styles from "./help-link.module.css";

export function HelpLink({ section, label }: { section: ManualSectionId; label: string }) {
  return (
    <Link className={styles.link} href={`/portal/ajuda#${section}`} aria-label={`Ajuda sobre ${label}`}>
      <span aria-hidden="true">?</span> Ajuda
    </Link>
  );
}
