export default function ProfileAvatar({ name, size = "regular" }) {
  const initials = name.split(" ").map((part) => part[0]).slice(0, 2).join("");
  return (
    <span className={`avatar${size === "large" ? " avatar--large" : ""}`} aria-hidden="true">
      {initials}
    </span>
  );
}
