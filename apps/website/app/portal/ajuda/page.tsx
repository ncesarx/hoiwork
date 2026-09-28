import Link from "next/link";
import { manualSections } from "./manual";
import styles from "./page.module.css";

export const metadata = {
  title: "Ajuda / Manual HOIWORK | Portal Enterprise",
  robots: { index: false, follow: false },
};

export default function HelpPage() {
  return (
    <div className={styles.manual}>
      <header className="portal-heading">
        <span>Centro de ajuda</span>
        <h1>Manual HOIWORK</h1>
        <p>Do primeiro acesso à operação avançada. Escolha um capítulo ou siga a ordem do manual para conhecer o Portal Enterprise.</p>
      </header>

      <div className={styles.layout}>
        <nav id="indice" aria-label="Índice do manual" className={styles.index} tabIndex={-1}>
          <h2>Índice por seções</h2>
          <ol>
            {manualSections.map((section) => (
              <li key={section.id}><a href={`#${section.id}`}>{section.title}</a></li>
            ))}
          </ol>
        </nav>

        <div className={styles.chapters}>
          {manualSections.map((section, index) => (
            <section key={section.id} id={section.id} aria-labelledby={`${section.id}-title`} className={styles.chapter} tabIndex={-1}>
              <span className={styles.level}>{String(index + 1).padStart(2, "0")} · {section.level}</span>
              <h2 id={`${section.id}-title`}>{section.title}</h2>
              <p>{section.intro}</p>
              <ol>{section.steps.map((step) => <li key={step}>{step}</li>)}</ol>
              <p className={styles.note}>{section.note}</p>
              <div className={styles.links}>
                {section.links.map((link) => <Link key={link.href} href={link.href}>{link.label} <span aria-hidden="true">→</span></Link>)}
              </div>
              <a className={styles.back} href="#indice">Voltar ao índice ↑</a>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
