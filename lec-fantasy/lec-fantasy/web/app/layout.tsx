export default function Root({ children }: { children: React.ReactNode }) {
  return <html lang="es"><body style={{ fontFamily: "system-ui", margin: 24 }}>{children}</body></html>;
}
