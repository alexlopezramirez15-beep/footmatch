// Textos legales base (versión 2026-10). BORRADOR: deben revisarse con asesoría jurídica antes del lanzamiento.
// Disponibles en español e inglés; catalán y polaco muestran el texto en español con aviso.
type Doc = { title: string; updated: string; sections: Array<{ h: string; p: string[] }> };

export const TERMS: Record<"es" | "en", Doc> = {
  es: {
    title: "Términos de uso",
    updated: "Versión 2026-10",
    sections: [
      { h: "1. Qué es FOOTMATCH", p: ["FOOTMATCH es una plataforma que conecta futbolistas, clubes, academias, entrenadores, agentes y scouts mediante perfiles deportivos, oportunidades y un sistema de compatibilidad transparente. FOOTMATCH no es parte de ningún acuerdo deportivo o laboral entre usuarios."] },
      { h: "2. Cuentas", p: ["Debes facilitar datos veraces y mantener la seguridad de tu contraseña. Cada persona puede tener una única cuenta.", "Los clubes y academias declaran tener autorización para actuar en nombre de la entidad. FOOTMATCH puede verificar entidades y retirar la verificación si detecta información falsa."] },
      { h: "3. Menores de edad", p: ["Los menores de 18 años necesitan la autorización expresa de su madre, padre o tutor legal antes de poder contactar o ser contactados por organizaciones. Sus datos de contacto y ubicación precisa nunca se muestran públicamente y sus conversaciones están supervisadas por el tutor.", "Está prohibido cualquier intento de contactar con menores fuera de los canales supervisados de la plataforma."] },
      { h: "4. Conducta", p: ["No está permitido publicar contenido falso, engañoso, ofensivo o discriminatorio, solicitar pagos a jugadores por pruebas sin informarlo de forma clara, suplantar identidades ni usar la plataforma para spam.", "Puedes reportar perfiles, oportunidades y mensajes. El equipo de moderación revisará los reportes y podrá suspender cuentas."] },
      { h: "5. Compatibilidad", p: ["El porcentaje de compatibilidad se calcula con criterios ponderados a partir de los datos de los perfiles y de las oportunidades. Es orientativo y no garantiza ningún resultado deportivo."] },
      { h: "6. Contenido", p: ["Conservas los derechos sobre el contenido que publicas y concedes a FOOTMATCH una licencia limitada para mostrarlo dentro de la plataforma según la visibilidad que elijas."] },
      { h: "7. Planes", p: ["El uso básico es gratuito. Si en el futuro se ofrecen planes de pago, sus condiciones se mostrarán antes de la contratación."] },
      { h: "8. Baja", p: ["Puedes eliminar tu cuenta en cualquier momento desde Ajustes. Tus datos personales se anonimizarán según la Política de privacidad."] },
    ],
  },
  en: {
    title: "Terms of Use",
    updated: "Version 2026-10",
    sections: [
      { h: "1. What FOOTMATCH is", p: ["FOOTMATCH is a platform that connects players, clubs, academies, coaches, agents and scouts through sports profiles, opportunities and a transparent compatibility system. FOOTMATCH is not a party to any sporting or employment agreement between users."] },
      { h: "2. Accounts", p: ["You must provide accurate information and keep your password secure. Each person may hold a single account.", "Clubs and academies declare that they are authorised to act on behalf of the entity. FOOTMATCH may verify entities and withdraw verification if false information is detected."] },
      { h: "3. Minors", p: ["Users under 18 need explicit authorisation from a parent or legal guardian before they can contact or be contacted by organisations. Their contact details and precise location are never shown publicly and their conversations are supervised by the guardian.", "Any attempt to contact minors outside the platform's supervised channels is forbidden."] },
      { h: "4. Conduct", p: ["You may not publish false, misleading, offensive or discriminatory content, charge players for trials without stating it clearly, impersonate others or use the platform for spam.", "You can report profiles, opportunities and messages. The moderation team will review reports and may suspend accounts."] },
      { h: "5. Compatibility", p: ["The compatibility percentage is calculated with weighted criteria from profile and opportunity data. It is indicative and does not guarantee any sporting outcome."] },
      { h: "6. Content", p: ["You keep the rights to the content you publish and grant FOOTMATCH a limited licence to display it within the platform according to the visibility you choose."] },
      { h: "7. Plans", p: ["Basic use is free. If paid plans are offered in the future, their terms will be shown before purchase."] },
      { h: "8. Closing your account", p: ["You can delete your account at any time from Settings. Your personal data will be anonymised as described in the Privacy Policy."] },
    ],
  },
};

export const PRIVACY: Record<"es" | "en", Doc> = {
  es: {
    title: "Política de privacidad",
    updated: "Versión 2026-10",
    sections: [
      { h: "1. Responsable", p: ["El responsable del tratamiento es el titular de FOOTMATCH (datos de contacto pendientes de completar antes del lanzamiento)."] },
      { h: "2. Datos que tratamos", p: ["Datos de cuenta (nombre, correo), datos de perfil deportivo (posición, trayectoria, estadísticas declaradas, vídeos y fotos), ubicación aproximada (país, región y ciudad), actividad en la plataforma (intereses, candidaturas, mensajes) y consentimientos legales."] },
      { h: "3. Finalidades y base legal", p: ["Prestar el servicio y calcular la compatibilidad (ejecución del contrato), garantizar la seguridad y moderar contenido (interés legítimo), y gestionar la autorización parental de menores (consentimiento del tutor, RGPD art. 8 y LOPIVI)."] },
      { h: "4. Menores", p: ["Los perfiles de menores sólo son visibles para organizaciones verificadas una vez que el tutor legal lo autoriza, muestran el nombre y la inicial del apellido, y nunca la ciudad ni datos de contacto. El tutor puede revocar la autorización en cualquier momento."] },
      { h: "5. Destinatarios", p: ["Los datos se alojan en Supabase (infraestructura en la UE si se selecciona esa región). No vendemos datos personales. Otros usuarios sólo ven lo que tu configuración de visibilidad permite."] },
      { h: "6. Conservación", p: ["Conservamos los datos mientras la cuenta esté activa. Al eliminarla, los datos personales se anonimizan y los mensajes se desvinculan de tu identidad; los registros de auditoría de seguridad pueden conservarse el tiempo legalmente exigido."] },
      { h: "7. Tus derechos", p: ["Puedes acceder, rectificar, exportar (Ajustes → Descargar mis datos), oponerte y suprimir tus datos (Ajustes → Eliminar cuenta). También puedes reclamar ante la Agencia Española de Protección de Datos."] },
    ],
  },
  en: {
    title: "Privacy Policy",
    updated: "Version 2026-10",
    sections: [
      { h: "1. Controller", p: ["The data controller is the owner of FOOTMATCH (contact details to be completed before launch)."] },
      { h: "2. Data we process", p: ["Account data (name, email), sports profile data (position, career, declared statistics, videos and photos), approximate location (country, region and city), platform activity (interests, applications, messages) and legal consents."] },
      { h: "3. Purposes and legal basis", p: ["Providing the service and computing compatibility (performance of contract), ensuring security and moderating content (legitimate interest), and managing parental authorisation for minors (guardian consent, GDPR art. 8)."] },
      { h: "4. Minors", p: ["Minors' profiles are only visible to verified organisations once the legal guardian authorises it, show first name and surname initial, and never their city or contact details. The guardian can revoke authorisation at any time."] },
      { h: "5. Recipients", p: ["Data is hosted on Supabase (EU infrastructure if that region is selected). We do not sell personal data. Other users only see what your visibility settings allow."] },
      { h: "6. Retention", p: ["We keep data while the account is active. When it is deleted, personal data is anonymised and messages are unlinked from your identity; security audit logs may be kept for the legally required period."] },
      { h: "7. Your rights", p: ["You can access, rectify, export (Settings → Download my data), object to and erase your data (Settings → Delete account). You may also complain to your data protection authority."] },
    ],
  },
};
