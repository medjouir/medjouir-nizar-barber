import { Phone, WhatsApp } from "@/components/icons";
import { buttonClasses } from "@/components/ui/button";
import { whatsappUrl } from "@/lib/phone";

/** WhatsApp + 3ayet buttons for a client phone (E.164). */
export function ContactActions({ phone }: { phone: string }) {
  if (!phone) return null;
  return (
    <div className="grid grid-cols-2 gap-3">
      <a href={whatsappUrl(phone)} target="_blank" rel="noopener noreferrer" className={buttonClasses("secondary", "h-12")}>
        <WhatsApp width={18} height={18} />
        WhatsApp
      </a>
      <a href={`tel:${phone}`} className={buttonClasses("secondary", "h-12")}>
        <Phone width={18} height={18} />
        3ayet
      </a>
    </div>
  );
}
