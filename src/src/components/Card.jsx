export default function Cartao({ children, className = "", ...props }) {
  return <section className={`card ${className}`.trim()} {...props}>{children}</section>;
}
