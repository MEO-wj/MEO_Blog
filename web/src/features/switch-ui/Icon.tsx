import type { SwitchHomeAction } from "./switchHomeData";

export type IconName =
  | SwitchHomeAction["icon"]
  | "home"
  | "posts"
  | "repo"
  | "lab"
  | "profile"
  | "settings";

export function Icon({ name }: { name: IconName }) {
  switch (name) {
    case "favorite":
      return (
        <svg viewBox="0 0 32 32" aria-hidden="true">
          <path d="m16 5 3.2 6.5 7.2 1-5.2 5.1 1.2 7.2L16 21.4l-6.4 3.4 1.2-7.2-5.2-5.1 7.2-1z" />
          <path d="M9.5 27.5h13" />
        </svg>
      );
    case "home":
      return (
        <svg viewBox="0 0 32 32" aria-hidden="true">
          <path d="M5 15.5 16 5.5l11 10" />
          <path d="M8.5 14V26h15V14" />
          <path d="M13 26v-6h6v6" />
        </svg>
      );
    case "posts":
      return (
        <svg viewBox="0 0 32 32" aria-hidden="true">
          <path d="M8 5h13l3 3v17H8z" />
          <path d="M12 12h8" />
          <path d="M12 17h8" />
          <path d="M12 22h5" />
        </svg>
      );
    case "repo":
      return (
        <svg viewBox="0 0 32 32" aria-hidden="true">
          <path d="M9 6h14v18H9z" />
          <path d="M9 10h14" />
          <path d="M13 15h6" />
          <path d="M13 20h6" />
        </svg>
      );
    case "resume":
      return (
        <svg viewBox="0 0 32 32" aria-hidden="true">
          <path d="M9 5h10l4 4v18H9z" />
          <path d="M19 5v5h5" />
          <circle cx="16" cy="15" r="3" />
          <path d="M11.5 23a5 5 0 0 1 9 0" />
        </svg>
      );
    case "blog":
      return (
        <svg viewBox="0 0 32 32" aria-hidden="true">
          <path d="M7 6h18v20H7z" />
          <path d="M11 11h10" />
          <path d="M11 16h7" />
          <path d="M11 21h5" />
          <path d="m21 20 4-4 2 2-4 4-3 1z" />
        </svg>
      );
    case "contact":
      return (
        <svg viewBox="0 0 32 32" aria-hidden="true">
          <path d="M5 9h22v15H5z" />
          <path d="m6 10 10 8 10-8" />
          <path d="M10 24v3" />
          <path d="M22 24v3" />
        </svg>
      );
    case "admin":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12.3 2h-.6a2 2 0 0 0-2 2v.3a2 2 0 0 1-1 1.7l-.4.2a2 2 0 0 1-2 0l-.3-.1a2 2 0 0 0-2.7.7L3 7.3A2 2 0 0 0 3.7 10l.3.2a2 2 0 0 1 1 1.7v.3a2 2 0 0 1-1 1.7l-.3.2A2 2 0 0 0 3 16.8l.3.5A2 2 0 0 0 6 18l.3-.1a2 2 0 0 1 2 0l.4.2a2 2 0 0 1 1 1.7v.2a2 2 0 0 0 2 2h.6a2 2 0 0 0 2-2v-.2a2 2 0 0 1 1-1.7l.4-.2a2 2 0 0 1 2 0l.3.1a2 2 0 0 0 2.7-.7l.3-.5a2 2 0 0 0-.7-2.7l-.3-.2a2 2 0 0 1-1-1.7v-.3a2 2 0 0 1 1-1.7l.3-.2a2 2 0 0 0 .7-2.7l-.3-.5a2 2 0 0 0-2.7-.7l-.3.1a2 2 0 0 1-2 0l-.4-.2a2 2 0 0 1-1-1.7V4a2 2 0 0 0-2-2z" />
          <circle cx="12" cy="12" r="3" />
        </svg>
      );
    case "lab":
      return (
        <svg viewBox="0 0 32 32" aria-hidden="true">
          <path d="M13 5h6" />
          <path d="M14.5 5v6.5l-6.5 10a2.5 2.5 0 0 0 2.1 4h12.8a2.5 2.5 0 0 0 2.1-4l-6.5-10V5" />
          <path d="M11 21.5h10" />
        </svg>
      );
    case "profile":
      return (
        <svg viewBox="0 0 32 32" aria-hidden="true">
          <circle cx="16" cy="11" r="5" />
          <path d="M6 27a10 10 0 0 1 20 0" />
        </svg>
      );
    case "settings":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12.3 2h-.6a2 2 0 0 0-2 2v.3a2 2 0 0 1-1 1.7l-.4.2a2 2 0 0 1-2 0l-.3-.1a2 2 0 0 0-2.7.7L3 7.3A2 2 0 0 0 3.7 10l.3.2a2 2 0 0 1 1 1.7v.3a2 2 0 0 1-1 1.7l-.3.2A2 2 0 0 0 3 16.8l.3.5A2 2 0 0 0 6 18l.3-.1a2 2 0 0 1 2 0l.4.2a2 2 0 0 1 1 1.7v.2a2 2 0 0 0 2 2h.6a2 2 0 0 0 2-2v-.2a2 2 0 0 1 1-1.7l.4-.2a2 2 0 0 1 2 0l.3.1a2 2 0 0 0 2.7-.7l.3-.5a2 2 0 0 0-.7-2.7l-.3-.2a2 2 0 0 1-1-1.7v-.3a2 2 0 0 1 1-1.7l.3-.2a2 2 0 0 0 .7-2.7l-.3-.5a2 2 0 0 0-2.7-.7l-.3.1a2 2 0 0 1-2 0l-.4-.2a2 2 0 0 1-1-1.7V4a2 2 0 0 0-2-2z" />
          <circle cx="12" cy="12" r="3" />
        </svg>
      );
    case "power":
      return (
        <svg viewBox="0 0 32 32" aria-hidden="true">
          <path d="M16 4v11" />
          <path d="M9.5 8.5a10 10 0 1 0 13 0" />
        </svg>
      );
    case "github":
      return (
        <svg viewBox="0 0 32 32" aria-hidden="true">
          <path d="M10.5 25.5c-3.5 1.2-3.5-1.5-5-2.5" />
          <path d="M21.5 29v-4.5c0-1.2.3-2-.6-2.8 3-.4 6.1-1.5 6.1-6.5 0-1.5-.5-2.8-1.4-3.8.1-.4.6-1.9-.1-3.8 0 0-1.2-.4-4 1.4a14 14 0 0 0-7.2 0c-2.8-1.8-4-1.4-4-1.4-.7 1.9-.2 3.4-.1 3.8-.9 1-1.4 2.3-1.4 3.8 0 5 3.1 6.1 6.1 6.5-.5.4-.8 1.1-.9 2.1V29" />
        </svg>
      );
  }
}
