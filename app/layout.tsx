import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "Barbería | Agenda tu cita",
  description: "Consulta servicios y reserva tu próxima cita.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body>
        <header className="site-header">
          <Link className="brand" href="/">
            <span aria-hidden="true">B.</span> Barbería
          </Link>
          <nav aria-label="Navegación principal">
            <Link href="/#servicios">Servicios</Link>
            <Link href="/book">Agendar</Link>
            <Link href="/dashboard">Mi agenda</Link>
            <Link className="nav-cta" href="/login">
              Entrar
            </Link>
          </nav>
        </header>
        {children}
        <footer className="site-footer">
          <p>Atención con cita. Nos encantará recibirte.</p>
        </footer>
      </body>
    </html>
  );
}

